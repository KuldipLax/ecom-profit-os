import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";
import { RazorpayAdapter } from "./razorpay";

export async function syncRazorpayBusiness(businessId: string, start?: string, end?: string) {
  const s = createAdminClient();
  const { data: integration } = await s
    .from("integrations")
    .select("id,last_sync_at")
    .eq("business_id", businessId)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (!integration) throw new Error("Razorpay is not connected.");

  const { data: account } = await s
    .from("integration_accounts")
    .select("credentials_encrypted")
    .eq("integration_id", integration.id)
    .limit(1)
    .maybeSingle();

  if (!account?.credentials_encrypted) throw new Error("Razorpay credentials are missing.");

  const credentials = JSON.parse(decryptSecret(account.credentials_encrypted));
  const to = end ?? new Date().toISOString();
  const from = start ?? new Date(Date.now() - 90 * 86400000).toISOString();
  const adapter = new RazorpayAdapter(String(credentials.keyId ?? ""), String(credentials.keySecret ?? ""));

  await s.from("integrations").update({ status: "syncing", error_message: null }).eq("id", integration.id);
  const { data: job } = await s.from("sync_jobs").insert({
    business_id: businessId,
    provider: "razorpay",
    job_type: "payments",
    status: "running",
    started_at: new Date().toISOString(),
  }).select("id").single();

  let created = 0;
  let updated = 0;
  try {
    const rows = await adapter.listTransactions(from, to);
    for (const row of rows) {
      let orderId: string | null = null;
      if (row.orderNumber) {
        const { data: order } = await s
          .from("orders")
          .select("id")
          .eq("business_id", businessId)
          .or(`external_order_id.eq.${row.orderNumber},order_number.eq.${row.orderNumber}`)
          .limit(1)
          .maybeSingle();
        orderId = order?.id ?? null;
      }

      const payload = {
        business_id: businessId,
        provider: "razorpay",
        external_transaction_id: row.externalTransactionId,
        order_id: orderId,
        order_number: row.orderNumber || null,
        transaction_date: row.transactionDate,
        payment_method: row.paymentMethod,
        status: row.paymentStatus,
        amount: row.transactionValue,
        fee: row.checkoutFee,
        gst_amount: null,
        source_payload: row,
      };

      const { data: existing } = await s
        .from("payment_transactions")
        .select("id")
        .eq("business_id", businessId)
        .eq("provider", "razorpay")
        .eq("external_transaction_id", row.externalTransactionId)
        .maybeSingle();

      const { error } = await s.from("payment_transactions").upsert(payload, {
        onConflict: "business_id,provider,external_transaction_id",
      });
      if (error) throw error;
      if (existing) updated++;
      else created++;
    }

    await s.from("integrations").update({
      status: "connected",
      last_sync_at: new Date().toISOString(),
    }).eq("id", integration.id);

    await s.from("sync_jobs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      records_processed: rows.length,
      records_created: created,
      records_updated: updated,
    }).eq("id", job?.id);

    return { records: rows.length, created, updated };
  } catch (error: any) {
    await s.from("integrations").update({
      status: "failed",
      error_message: "Razorpay sync failed. Retry sync.",
    }).eq("id", integration.id);

    await s.from("sync_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      errors: [{ message: error?.message ?? String(error) }],
    }).eq("id", job?.id);

    throw error;
  }
}
