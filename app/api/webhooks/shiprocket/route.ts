import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { timingSafeEqualString } from "@/lib/security/hmac";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const provided = req.headers.get("x-api-key") ?? "";
  if (!env.SHIPROCKET_WEBHOOK_SECRET || !timingSafeEqualString(provided, env.SHIPROCKET_WEBHOOK_SECRET)) return NextResponse.json({ error: "Invalid shipping webhook signature." }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const eventId = String(req.headers.get("x-event-id") ?? payload?.event_id ?? payload?.awb ?? payload?.shipment_id ?? crypto.randomUUID());
  const s = createAdminClient();
  let link: any = null;
  if (payload?.shipment_id != null) {
    const { data } = await s.from("shipping_orders").select("id,business_id,order_id").eq("provider", "shiprocket").eq("external_shipment_id", String(payload.shipment_id)).maybeSingle();
    link = data ?? null;
  }
  if (!link && payload?.awb) {
    const { data } = await s.from("shipping_orders").select("id,business_id,order_id").eq("provider", "shiprocket").eq("awb", String(payload.awb)).maybeSingle();
    link = data ?? null;
  }
  const businessId = link?.business_id ?? null;
  const { error } = await s.from("webhook_events").insert({ business_id: businessId, provider: "shiprocket", external_event_id: eventId, topic: "tracking.update", signature: provided, payload, status: "received" });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Webhook storage failed." }, { status: 500 });
  }
  if (!link) return NextResponse.json({ received: true, ignored: true });
  const status = String(payload?.current_status ?? payload?.status ?? payload?.shipment_status ?? "OPEN");
  const lower = status.toLowerCase();
  let normalized = "OPEN";
  if (lower.includes("rto") && lower.includes("deliver")) normalized = "RTO_DELIVERED";
  else if (lower.includes("rto") && lower.includes("transit")) normalized = "RTO_IN_TRANSIT";
  else if (lower.includes("rto")) normalized = "RTO_PROCESSING";
  else if (lower.includes("deliver")) normalized = "DELIVERED";
  else if (lower.includes("destination")) normalized = "REACHED_DESTINATION";
  else if (lower.includes("transit")) normalized = "IN_TRANSIT";
  else if (lower.includes("ship") || lower.includes("pickup")) normalized = "SHIPPED";
  else if (lower.includes("undeliver") || lower.includes("ndr")) normalized = "UNDELIVERED";
  await s.from("shipping_orders").update({ shipment_status: status, normalized_status: normalized }).eq("id", link.id);
  if (link.order_id) await s.from("orders").update({ status: normalized }).eq("id", link.order_id).neq("status", "CANCELLED");
  await s.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider", "shiprocket").eq("external_event_id", eventId);
  return NextResponse.json({ received: true, processed: true });
}
