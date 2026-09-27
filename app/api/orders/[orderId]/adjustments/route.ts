import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  businessId: z.string().uuid(),
  adjustmentType: z.enum(["COGS", "CHECKOUT_FEE", "PG_FEE", "SHIPPING", "OPERATIONAL_COST", "REFUND", "OTHER_COST"]),
  amount: z.coerce.number().finite(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const body = schema.parse(await request.json());
    const { orderId } = await params;
    const membership = await requireBusinessAccess(body.businessId, ["client", "admin", "super_admin"]);
    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase.from("orders").select("id,business_id").eq("id", orderId).eq("business_id", body.businessId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found in this business." }, { status: 404 });
    const { data, error } = await supabase.from("manual_adjustments").insert({
      business_id: body.businessId, order_id: orderId, adjustment_type: body.adjustmentType,
      amount: body.amount, reason: body.reason, created_by: membership.user.id,
    }).select("*").single();
    if (error) throw error;
    await supabase.from("audit_logs").insert({
      business_id: body.businessId, user_id: membership.user.id, action: "order.manual_adjustment.created",
      entity_type: "manual_adjustment", entity_id: data.id, new_value: data,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Could not save adjustment." }, { status: 400 });
  }
}
