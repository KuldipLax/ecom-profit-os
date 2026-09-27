import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/security/encryption";
import { hmacSha256Base64, timingSafeEqualString } from "@/lib/security/hmac";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const shop = (req.headers.get("x-shopify-shop-domain") ?? "").toLowerCase();
  const topic = req.headers.get("x-shopify-topic") ?? "unknown";
  const eventId = req.headers.get("x-shopify-webhook-id") ?? randomUUID();
  const s = createAdminClient();

  const { data: account } = await s
    .from("integration_accounts")
    .select("integration_id,credentials_encrypted,integrations(business_id)")
    .eq("external_account_id", shop)
    .limit(1)
    .maybeSingle();

  let webhookSecret = env.SHOPIFY_WEBHOOK_SECRET ?? env.SHOPIFY_CLIENT_SECRET ?? "";
  if (account?.credentials_encrypted) {
    try {
      const credentials = JSON.parse(decryptSecret(account.credentials_encrypted));
      webhookSecret = String(credentials.webhookSecret ?? webhookSecret);
    } catch {
      return NextResponse.json({ error: "Shopify webhook credentials are invalid." }, { status: 500 });
    }
  }

  if (!webhookSecret || !timingSafeEqualString(sig, hmacSha256Base64(webhookSecret, raw))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const businessId = (account as any)?.integrations?.business_id ?? null;
  const { error } = await s.from("webhook_events").insert({
    business_id: businessId,
    provider: "shopify",
    external_event_id: eventId,
    topic,
    signature: sig,
    payload,
    status: "received",
  });

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Webhook storage failed." }, { status: 500 });
  }

  if (!businessId) return NextResponse.json({ received: true, ignored: true });

  await s.from("sync_jobs").insert({
    business_id: businessId,
    provider: "shopify",
    job_type: `webhook:${topic}`,
    status: "queued",
    metadata: { webhook_event_id: eventId },
  });

  await s.from("webhook_events").update({ status: "queued" }).eq("provider", "shopify").eq("external_event_id", eventId);
  return NextResponse.json({ received: true });
}
