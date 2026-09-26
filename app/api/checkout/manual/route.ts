import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  businessId: z.string().uuid(),
  externalTransactionId: z.string().trim().min(1).max(160),
  orderNumber: z.string().trim().max(120).optional(),
  transactionDate: z.string().datetime(),
  paymentMethod: z.enum(["prepaid", "cod", "unknown"]),
  paymentStatus: z.string().max(80).optional(),
  transactionValue: z.coerce.number().nonnegative(),
  checkoutFee: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).default("INR"),
});

export async function POST(req: NextRequest) {
  try {
    const b = schema.parse(await req.json());
    const m = await requireBusinessAccess(b.businessId, ["client", "admin", "super_admin"]);
    const s = await createClient();
    const { data: order } = b.orderNumber
      ? await s.from("orders").select("id").eq("business_id", b.businessId).eq("order_number", b.orderNumber).maybeSingle()
      : { data: null };
    const payload = {
      business_id: b.businessId,
      provider: "manual",
      external_transaction_id: b.externalTransactionId,
      order_id: order?.id ?? null,
      order_number: b.orderNumber ?? null,
      transaction_date: b.transactionDate,
      payment_method: b.paymentMethod,
      payment_status: b.paymentStatus ?? null,
      transaction_value: b.transactionValue,
      checkout_fee: b.checkoutFee ?? null,
      currency: b.currency.toUpperCase(),
      source_payload: { source: "manual_entry" },
    };
    const { data, error } = await s.from("checkout_transactions").upsert(payload, { onConflict: "business_id,provider,external_transaction_id" }).select("id,external_transaction_id").single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "That checkout transaction already exists." }, { status: 409 });
      throw error;
    }
    await s.from("audit_logs").insert({ business_id: b.businessId, user_id: m.user.id, action: "checkout.manual.upserted", entity_type: "checkout_transaction", entity_id: data.id, new_value: payload });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message ?? e?.message ?? "Checkout transaction could not be saved." }, { status: 400 });
  }
}
