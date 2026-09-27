import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";
import { timingSafeEqualString } from "@/lib/security/hmac";

export const runtime = "nodejs";

function normalize(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes("rto") && value.includes("deliver")) return "RTO_DELIVERED";
  if (value.includes("rto") && value.includes("transit")) return "RTO_IN_TRANSIT";
  if (value.includes("rto")) return "RTO_PROCESSING";
  if (value.includes("deliver")) return "DELIVERED";
  if (value.includes("destination")) return "REACHED_DESTINATION";
  if (value.includes("transit")) return "IN_TRANSIT";
  if (value.includes("ship") || value.includes("pickup")) return "SHIPPED";
  if (value.includes("cancel")) return "CANCELLED";
  if (value.includes("undeliver") || value.includes("ndr")) return "UNDELIVERED";
  return "OPEN";
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
  const { data: integration } = await s
    .from("integrations")
    .select("id,metadata,status")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .maybeSingle();

  if (!integration) return NextResponse.json({ error: "Webhook endpoint is not configured." }, { status: 404 });

  const { data: account } = await s
    .from("integration_accounts")
    .select("credentials_encrypted")
    .eq("integration_id", integration.id)
    .limit(1)
    .maybeSingle();

  if (!account?.credentials_encrypted) return NextResponse.json({ error: "Webhook credentials are not configured." }, { status: 401 });

  const credentials = JSON.parse(decryptSecret(account.credentials_encrypted));
  const secret = String(credentials.webhookSecret ?? "");
  const provided = request.headers.get("x-api-key") ?? request.headers.get("x-webhook-secret") ?? request.headers.get("x-webhook-signature") ?? "";
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured for this integration." }, { status: 409 });
  if (!timingSafeEqualString(provided, secret)) return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });

  const eventId = String(
    request.headers.get("x-event-id")
      ?? request.headers.get("x-webhook-id")
      ?? payload?.event_id
      ?? payload?.shipment_id
      ?? payload?.awb
      ?? randomUUID(),
  );

  const { error } = await s.from("webhook_events").insert({
    business_id: businessId,
    provider,
    external_event_id: eventId,
    topic: String(request.headers.get("x-webhook-topic") ?? payload?.event ?? "tracking.update"),
    signature: provided || null,
    payload,
    status: "received",
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Webhook storage failed." }, { status: 500 });
  }

  const externalShipmentId = payload?.shipment_id ?? payload?.shipmentId ?? payload?.shipment?.id ?? payload?.id ?? null;
  const awb = payload?.awb ?? payload?.waybill ?? payload?.waybill_number ?? payload?.shipment?.awb ?? null;
  let shipping: any = null;
  if (externalShipmentId != null) {
    const { data } = await s.from("shipping_orders").select("id,order_id").eq("business_id", businessId).eq("provider", provider).eq("external_shipment_id", String(externalShipmentId)).maybeSingle();
    shipping = data ?? null;
  }
  if (!shipping && awb != null) {
    const { data } = await s.from("shipping_orders").select("id,order_id").eq("business_id", businessId).eq("provider", provider).eq("awb", String(awb)).maybeSingle();
    shipping = data ?? null;
  }

  if (!shipping) {
    await s.from("webhook_events").update({
      status: "received",
      error_message: "Shipment could not be linked yet.",
    }).eq("provider", provider).eq("external_event_id", eventId);
    return NextResponse.json({ received: true, queued: false, linked: false });
  }

  const status = String(payload?.current_status ?? payload?.status ?? payload?.shipment_status ?? payload?.shipment?.status ?? "OPEN");
  const normalizedStatus = normalize(status);
  await s.from("shipping_orders").update({
    shipment_status: status,
    normalized_status: normalizedStatus,
    ...(normalizedStatus === "DELIVERED" ? { delivery_date: new Date().toISOString() } : {}),
  }).eq("id", shipping.id);

  if (shipping.order_id) {
    await s.from("orders").update({ status: normalizedStatus }).eq("id", shipping.order_id).neq("status", "CANCELLED");
  }

  await s.from("shipping_events").insert({
    business_id: businessId,
    shipping_order_id: shipping.id,
    external_event_id: eventId,
    status,
    normalized_status: normalizedStatus,
    event_at: new Date().toISOString(),
    location: payload?.location ?? payload?.scan_location ?? null,
    remarks: payload?.remarks ?? payload?.description ?? null,
    source_payload: payload,
  });

  await s.from("webhook_events").update({
    status: "processed",
    processed_at: new Date().toISOString(),
  }).eq("provider", provider).eq("external_event_id", eventId);

  return NextResponse.json({ received: true, processed: true });
}
