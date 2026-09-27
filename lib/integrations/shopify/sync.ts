import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";
import { fetchShopifyOrders } from "./client";

function payment(g: string[]) {
  return g.some((x) => /cod|cash on delivery/i.test(x)) ? "cod" : "prepaid" as const;
}

function status(n: any) {
  if (n.cancelledAt) return "CANCELLED";
  if (/fulfilled|partial/i.test(String(n.displayFulfillmentStatus ?? ""))) return "SHIPPED";
  if (["PAID", "PENDING"].includes(String(n.displayFinancialStatus))) return "PROCESSING";
  return "OPEN";
}

export async function syncShopifyBusiness(businessId: string) {
  const s = createAdminClient();
  const { data: integration } = await s
    .from("integrations")
    .select("id,last_sync_at")
    .eq("business_id", businessId)
    .eq("provider", "shopify")
    .maybeSingle();

  if (!integration) throw new Error("Shopify is not connected.");

  const { data: account } = await s
    .from("integration_accounts")
    .select("external_account_id,credentials_encrypted")
    .eq("integration_id", integration.id)
    .limit(1)
    .maybeSingle();

  if (!account?.credentials_encrypted) throw new Error("Shopify authorization is missing. Reconnect Shopify.");

  const token = decryptSecret(account.credentials_encrypted);
  const lastSync = integration.last_sync_at
    ? new Date(new Date(integration.last_sync_at).getTime() - 15 * 60 * 1000).toISOString()
    : undefined;

  await s.from("integrations").update({ status: "syncing", error_message: null }).eq("id", integration.id);
  const { data: job } = await s
    .from("sync_jobs")
    .insert({ business_id: businessId, provider: "shopify", job_type: "orders", status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();

  let created = 0;
  let updated = 0;

  try {
    const nodes = await fetchShopifyOrders(account.external_account_id, token, lastSync);

    const productRows = new Map<string, any>();
    const variantRows = new Map<string, any>();
    for (const order of nodes) {
      for (const edge of order.lineItems?.edges ?? []) {
        const line = edge.node;
        const product = line.variant?.product;
        const variant = line.variant;
        if (product?.legacyResourceId) {
          const productExternalId = String(product.legacyResourceId);
          productRows.set(productExternalId, {
            business_id: businessId,
            external_product_id: productExternalId,
            title: product.title ?? line.title ?? "Untitled product",
            product_type: product.productType ?? null,
            status: "active",
          });
          if (variant?.legacyResourceId) {
            const variantExternalId = String(variant.legacyResourceId);
            variantRows.set(variantExternalId, {
              business_id: businessId,
              external_variant_id: variantExternalId,
              sku: variant.sku ?? null,
              title: variant.title ?? null,
              price: Number(variant.price ?? 0) || null,
              product_external_id: productExternalId,
            });
          }
        }
      }
    }

    const productIdByExternal = new Map<string, string>();
    if (productRows.size) {
      const { data, error } = await s
        .from("products")
        .upsert([...productRows.values()], { onConflict: "business_id,external_product_id" })
        .select("id,external_product_id");
      if (error) throw error;
      for (const row of data ?? []) productIdByExternal.set(String(row.external_product_id), row.id);
    }

    const variantIdByExternal = new Map<string, string>();
    if (variantRows.size) {
      const rows = [...variantRows.values()].map((row) => ({
        business_id: row.business_id,
        external_variant_id: row.external_variant_id,
        product_id: productIdByExternal.get(row.product_external_id) ?? null,
        sku: row.sku,
        title: row.title,
        price: row.price,
      })).filter((row) => row.product_id);
      if (rows.length) {
        const { data, error } = await s
          .from("variants")
          .upsert(rows, { onConflict: "business_id,external_variant_id" })
          .select("id,external_variant_id");
        if (error) throw error;
        for (const row of data ?? []) variantIdByExternal.set(String(row.external_variant_id), row.id);
      }
    }

    for (const n of nodes) {
      const ext = String(n.legacyResourceId ?? n.id);
      const orderPayload = {
        business_id: businessId,
        provider: "shopify",
        external_order_id: ext,
        order_number: String(n.name),
        order_date: n.createdAt,
        updated_at_source: n.updatedAt,
        customer_name: [n.shippingAddress?.firstName, n.shippingAddress?.lastName].filter(Boolean).join(" "),
        shipping_state: n.shippingAddress?.province ?? n.shippingAddress?.provinceCode ?? null,
        shipping_pincode: n.shippingAddress?.zip ?? null,
        shipping_city: n.shippingAddress?.city ?? null,
        payment_method: payment(n.paymentGatewayNames ?? []),
        gross_sale: Number(n.currentTotalPriceSet?.shopMoney?.amount ?? 0),
        discount_amount: Number(n.totalDiscountsSet?.shopMoney?.amount ?? 0),
        shipping_revenue: Number(n.totalShippingPriceSet?.shopMoney?.amount ?? 0),
        tax_amount: Number(n.totalTaxSet?.shopMoney?.amount ?? 0),
        refunded_amount: (n.refunds ?? []).reduce((x: number, r: any) => x + Number(r.totalRefundedSet?.shopMoney?.amount ?? 0), 0),
        status: status(n),
        financial_status: n.displayFinancialStatus,
        fulfillment_status: n.displayFulfillmentStatus,
        cancelled_at: n.cancelledAt ?? null,
        source_payload: n,
      };

      const existing = await s.from("orders").select("id").eq("business_id", businessId).eq("provider", "shopify").eq("external_order_id", ext).maybeSingle();
      const { data: order, error } = await s
        .from("orders")
        .upsert(orderPayload, { onConflict: "business_id,provider,external_order_id" })
        .select("id")
        .single();
      if (error) throw error;
      if (existing.data) updated++;
      else created++;

      const lines = (n.lineItems?.edges ?? []).map((e: any) => {
        const line = e.node;
        const productExternalId = line.variant?.product?.legacyResourceId ? String(line.variant.product.legacyResourceId) : null;
        const variantExternalId = line.variant?.legacyResourceId ? String(line.variant.legacyResourceId) : null;
        const quantity = Number(line.quantity ?? 0);
        const total = Number(line.discountedTotalSet?.shopMoney?.amount ?? 0);
        const original = Number(line.originalTotalSet?.shopMoney?.amount ?? 0);
        return {
          business_id: businessId,
          order_id: order.id,
          external_line_item_id: String(line.id),
          product_id: productExternalId ? productIdByExternal.get(productExternalId) ?? null : null,
          variant_id: variantExternalId ? variantIdByExternal.get(variantExternalId) ?? null : null,
          product_title: line.variant?.product?.title ?? line.title,
          sku: line.variant?.sku ?? null,
          quantity,
          unit_price: quantity ? total / quantity : 0,
          discount_amount: Math.max(0, original - total),
          line_total: total,
        };
      });

      if (lines.length) {
        const { error: lineError } = await s
          .from("order_items")
          .upsert(lines, { onConflict: "business_id,order_id,external_line_item_id" });
        if (lineError) throw lineError;
      }
    }

    await s.from("integrations").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", integration.id);
    await s.from("sync_jobs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      records_processed: nodes.length,
      records_created: created,
      records_updated: updated,
    }).eq("id", job?.id);

    return { records: nodes.length, created, updated };
  } catch (error: any) {
    await s.from("integrations").update({ status: "failed", error_message: "Shopify sync failed. Retry sync." }).eq("id", integration.id);
    await s.from("sync_jobs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      errors: [{ message: error?.message ?? String(error) }],
    }).eq("id", job?.id);
    throw error;
  }
}
