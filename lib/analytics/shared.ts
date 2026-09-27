import { createClient } from "@/lib/supabase/server";
import { buildProfitInput, normalizeSettings } from "@/lib/profit-engine/server";
import { calculatePeriodProfit } from "@/lib/profit-engine/calculation";
import { type CogsRecord } from "@/lib/profit-engine/cogs";
import { matchesOrder, type AnalyticsFilters } from "./filters";

const PAGE = 1000;

async function all(factory: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let p = 0; p < 1000; p++) {
    const { data, error } = await factory(p * PAGE, p * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export async function getRawForAnalytics(
  businessId: string,
  start: string,
  end: string,
  filters: AnalyticsFilters = {},
) {
  const supabase = await createClient();

  const [biz, orders, shipping, marketing, costs, products] = await Promise.all([
    supabase
      .from("businesses")
      .select("settings,currency,timezone")
      .eq("id", businessId)
      .maybeSingle(),
    all((from, to) =>
      supabase
        .from("orders")
        .select("*,order_items(*),shipping_orders(*),manual_adjustments(*)")
        .eq("business_id", businessId)
        .gte("order_date", `${start}T00:00:00Z`)
        .lte("order_date", `${end}T23:59:59Z`)
        .order("order_date", { ascending: true })
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("shipping_orders")
        .select("*")
        .eq("business_id", businessId)
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("marketing_spend")
        .select("*")
        .eq("business_id", businessId)
        .gte("date", start)
        .lte("date", end)
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("product_costs")
        .select("scope,variant_id,product_id,category,cost_per_unit,effective_from")
        .eq("business_id", businessId)
        .lte("effective_from", end)
        .range(from, to),
    ),
    all((from, to) =>
      supabase
        .from("products")
        .select("id,product_type,title")
        .eq("business_id", businessId)
        .range(from, to),
    ),
  ]);

  if (biz.error) throw new Error(biz.error.message);
  if (!biz.data) throw new Error("Business not found or not accessible.");

  const cr: CogsRecord[] = (costs ?? []).map((r: any) => ({
    scope: r.scope,
    variantId: r.variant_id,
    productId: r.product_id,
    category: r.category,
    costPerUnit: Number(r.cost_per_unit ?? 0),
    effectiveFrom: r.effective_from,
  }));

  const cat = new Map<string, string>(
    (products ?? []).map((p: any) => [p.id, p.product_type ?? ""]),
  );

  const filteredOrders = (orders ?? []).filter((order: any) => matchesOrder(order, filters));
  const inputs = filteredOrders.map((order: any) => buildProfitInput(order, cr, cat));

  const orderIds = new Set(filteredOrders.map((order: any) => order.id));
  const filteredShipping = (shipping ?? []).filter(
    (shipment: any) => Boolean(shipment.order_id) && orderIds.has(shipment.order_id),
  );

  // Meta spend is a period-level cost by design. It is intentionally kept
  // unfiltered because the product does not invent order-level attribution.
  const metaSpend = (marketing ?? []).reduce(
    (sum: number, row: any) => sum + Number(row.spend ?? 0),
    0,
  );

  const settings = normalizeSettings(biz.data.settings);
  const result = calculatePeriodProfit(inputs, settings, metaSpend);
  const metaGstRate = Number(settings.metaGstRate);

  return {
    business: biz.data,
    orders: filteredOrders,
    inputs,
    economicsByOrder: new Map(result.orderEconomics.map((x) => [x.orderId, x])),
    orderById: new Map(filteredOrders.map((order: any) => [order.id, order])),
    shipping: filteredShipping,
    marketing,
    costs,
    products,
    result,
    metaSpend,
    metaGstRate,
    metaEffectiveMarketingCost: result.effectiveMarketingCost,
  };
}
