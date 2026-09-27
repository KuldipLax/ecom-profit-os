import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";
import { timingSafeEqualString } from "@/lib/security/hmac";

export const runtime = "nodejs";

function paymentMethod(raw: unknown) {
  return /cod/i.test(String(raw ?? "")) ? "cod" : "prepaid";
}

async function processRazorpayPayment(s: ReturnType<typeof createAdminClient>, businessId: string, payload: any) {
  const entity = payload?.payload?.payment?.entity;
  if (!entity?.id) return false;

  let orderId: string | null = null;
  if (entity.order_id) {
    const { data } = await s.from("orders")
      .select("id")
      .eq("business_id", businessId)
      .or(`external_order_id.eq.${entity.order_id},order_number.eq.${entity.order_id}`)
      .limit(1)
      .maybeSingle();
    orderId = data?.id ?? null;
  }

  const amount = Number(entity.amount ?? 0) / 100;
  const fee = entity.fee == null ? null : Number(entity.fee) / 100;
  const tax = entity.tax == null ? null : Number(entity.tax) / 100;
  const createdAt = entity.created_at ? new Date(Number(entity.created_at) * 1000).toISOString() : new Date().toISOString();

  const { error } = await s.from("payment_transactions").upsert({
    business_id: businessId,
    provider: "razorpay",
    external_transaction_id: String(entity.id),
    order_id: orderId,
    status: String(entity.status ?? payload?.event ?? "unknown"),
    amount,
    fee,
    gst_amount: tax,
    transaction_date: createdAt,
    payment_method: paymentMethod(entity.method),
    source_payload: payload,
  }, { onConflict: "business_id,provider,external_transaction_id" });

  if (error) throw error;
  return true;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string; businessId: string }> },
) {
  const { provider, businessId } = await context.params;
  const raw = await request.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const s = createAdminClient();
  const { data: integration } = await s.from("integrations")
    .select("id")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .maybeSingle();

  if (!integration) return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 404 });

  const { data: account } = await s.from("integration_accounts")
    .select("credentials_encrypted")
    .eq("integration_id", integration.id)
    .limit(1)
    .maybeSingle();

  if (!account?.credentials_encrypted) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 401 });

  const credentials = JSON.parse(decryptSecret(account.credentials_encrypted));
  const secret = String(credentials.webhookSecret ?? "");
  const provided =
    request.headers.get("x-razorpay-signature") ??
    request.headers.get("x-api-key") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-webhook-signature") ??
    "";

  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured for this integration." }, { status: 409 });

  if (provider === "razorpay") {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (!timingSafeEqualString(provided, expected)) return NextResponse.json({ error: "Invalid checkout webhook signature." }, { status: 401 });
  } else if (!timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ error: "Invalid checkout webhook secret." }, { status: 401 });
  }

  const eventId = String(
    request.headers.get("x-razorpay-event-id") ??
    request.headers.get("x-event-id") ??
    request.headers.get("x-webhook-id") ??
    payload?.id ??
    payload?.event_id ??
    randomUUID(),
  );

  const insert = await s.from("webhook_events").insert({
    business_id: businessId,
    provider,
    external_event_id: eventId,
    topic: String(payload?.event ?? request.headers.get("x-webhook-topic") ?? "payment"),
    signature: provided || null,
    payload,
    status: "received",
  });

  if (insert.error) {
    if (/duplicate|unique/i.test(insert.error.message)) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Webhook storage failed." }, { status: 500 });
  }

  try {
    if (provider === "razorpay") {
      await processRazorpayPayment(s, businessId, payload);
    }

    await s.from("webhook_events").update({
      status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("provider", provider).eq("external_event_id", eventId);

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    await s.from("webhook_events").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error),
    }).eq("provider", provider).eq("external_event_id", eventId);

    return NextResponse.json({ error: "Webhook was received but processing failed." }, { status: 500 });
  }
}
