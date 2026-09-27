import { getRawForAnalytics } from "./shared";
import type { AnalyticsFilters } from "./filters";

const rtoStatus = (s: string) => ["RTO_PROCESSING", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(s);
const key = (v: unknown) => String(v ?? "").trim();

export async function getProductProfitability(businessId: string, start: string, end: string, filters: AnalyticsFilters = {}) {
  const raw = await getRawForAnalytics(businessId, start, end, filters);
  const map = new Map<string, any>();
  const totalDelivered = raw.result.deliveredRevenue;

  for (const input of raw.inputs) {
    const order = raw.orderById.get(input.orderId);
    const economics = raw.economicsByOrder.get(input.orderId);
    if (!order || !economics) continue;
    const lines = order.order_items ?? [];
    const lineTotal = lines.reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
    const fallbackShare = lines.length ? 1 / lines.length : 0;

    for (const item of lines) {
      const productKey = key(item.product_id) || key(item.product_title) || "unknown";
      const row = map.get(productKey) ?? {
        productId: item.product_id ?? null,
        title: item.product_title ?? "Unmapped Product",
        sku: item.sku ?? "",
        unitsSold: 0,
        unitsDelivered: 0,
        grossSales: 0,
        deliveredRevenue: 0,
        rtoOrders: 0,
        cogs: 0,
        shipping: 0,
        checkout: 0,
        pg: 0,
        marketingContribution: 0,
        netProfit: 0,
        orderKeys: new Set<string>(),
        rtoOrderKeys: new Set<string>(),
      };
      const share = lineTotal > 0 ? Number(item.line_total ?? 0) / lineTotal : fallbackShare;
      const quantity = Number(item.quantity ?? 0);
      row.unitsSold += quantity;
      row.grossSales += Number(order.gross_sale ?? 0) * share;
      row.orderKeys.add(String(order.id));

      if (economics.effectiveDelivered) {
        row.unitsDelivered += quantity;
        row.deliveredRevenue += economics.deliveredRevenue * share;
        row.cogs += economics.cogs * share;
        row.shipping += economics.shipping * share;
        row.checkout += economics.checkoutFee * share;
        row.pg += economics.pgFee * share;
        row.marketingContribution += totalDelivered ? raw.metaEffectiveMarketingCost * (economics.deliveredRevenue * share / totalDelivered) : 0;
      }
      if (economics.effectiveStatus === "RTO") row.rtoOrderKeys.add(String(order.id));
      map.set(productKey, row);
    }
  }

  return [...map.values()]
    .map((product) => ({
      ...product,
      netProfit: product.deliveredRevenue - product.cogs - product.shipping - product.checkout - product.pg - product.marketingContribution,
      orders: product.orderKeys.size,
      rtoOrders: product.rtoOrderKeys.size,
      rtoPercent: product.orderKeys.size ? product.rtoOrderKeys.size / product.orderKeys.size : 0,
      profitMargin: product.deliveredRevenue ? (product.deliveredRevenue - product.cogs - product.shipping - product.checkout - product.pg - product.marketingContribution) / product.deliveredRevenue : 0,
      aov: product.orders ? product.grossSales / product.orders : 0,
      profitPerUnit: product.unitsDelivered ? product.netProfit / product.unitsDelivered : 0,
    }))
    .map(({ orderKeys, rtoOrderKeys, ...product }) => product)
    .sort((a, b) => b.netProfit - a.netProfit);
}

export async function getMarketingProfitability(businessId: string, start: string, end: string, filters: AnalyticsFilters = {}) {
  const raw = await getRawForAnalytics(businessId, start, end, filters);
  const group = (level: "campaign" | "adset" | "ad") => {
    const map = new Map<string, any>();
    for (const row of raw.marketing) {
      const id = level === "campaign" ? row.campaign_id : level === "adset" ? row.adset_id : row.ad_id;
      const name = level === "campaign" ? row.campaign_name : level === "adset" ? row.adset_name : row.ad_name;
      const groupKey = key(id) || `unattributed-${level}`;
      const item = map.get(groupKey) ?? { level, id: groupKey, name: key(name) || "Unattributed", spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, conversionValue: 0 };
      item.spend += Number(row.spend ?? 0);
      item.impressions += Number(row.impressions ?? 0);
      item.reach += Number(row.reach ?? 0);
      item.clicks += Number(row.clicks ?? 0);
      item.purchases += Number(row.purchases ?? 0);
      item.conversionValue += Number(row.conversion_value ?? 0);
      map.set(groupKey, item);
    }
    return [...map.values()]
      .map((item) => ({
        ...item,
        metaGst: item.spend * raw.metaGstRate,
        effectiveMarketingCost: item.spend * (1 + raw.metaGstRate),
        cpm: item.impressions ? item.spend / item.impressions * 1000 : 0,
        cpc: item.clicks ? item.spend / item.clicks : 0,
        ctr: item.impressions ? item.clicks / item.impressions : 0,
        roas: item.spend ? item.conversionValue / item.spend : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  };
  const campaign = group("campaign");
  const adSet = group("adset");
  const ad = group("ad");
  return {
    campaign,
    adSet,
    ad,
    rows: campaign,
    total: raw.metaEffectiveMarketingCost,
    metaSpend: raw.result.metaSpend,
    metaGst: raw.result.metaGst,
    deliveredRevenue: raw.result.deliveredRevenue,
    profitAfterMarketing: raw.result.netProfit,
    roas: raw.result.roas,
  };
}

export async function getShippingIntelligence(businessId: string, start: string, end: string, filters: AnalyticsFilters = {}) {
  const raw = await getRawForAnalytics(businessId, start, end, filters);
  const byOrderAndCourier = new Map<string, any>();

  for (const shipment of raw.shipping) {
    const orderKey = key(shipment.order_id) || key(shipment.external_order_id) || key(shipment.id);
    const courier = key(shipment.courier_name) || "Unknown";
    const groupKey = `${orderKey}::${courier}`;
    const row = byOrderAndCourier.get(groupKey) ?? { orderKey, courier, freight: 0, unbilled: 0, forward: 0, rto: 0, cod: 0, gst: 0 };
    row.freight += Number(shipment.total_freight ?? 0);
    row.unbilled += Number(shipment.unbilled_charges ?? 0);
    row.forward += Number(shipment.forward_shipping_charge ?? 0);
    row.rto += Number(shipment.rto_charge ?? 0);
    row.cod += Number(shipment.cod_charge ?? 0);
    row.gst += Number(shipment.gst_charge ?? 0);
    byOrderAndCourier.set(groupKey, row);
  }

  const courierMap = new Map<string, any>();
  for (const item of byOrderAndCourier.values()) {
    const row = courierMap.get(item.courier) ?? { courier: item.courier, orders: new Set<string>(), forward: 0, rto: 0, cod: 0, gst: 0, freight: 0, unbilled: 0, practicalShippingCost: 0 };
    row.orders.add(item.orderKey);
    row.forward += item.forward;
    row.rto += item.rto;
    row.cod += item.cod;
    row.gst += item.gst;
    row.freight += item.freight;
    row.unbilled += item.unbilled;
    row.practicalShippingCost += Math.max(item.freight, item.unbilled);
    courierMap.set(item.courier, row);
  }

  const rows = [...courierMap.values()].map((row) => ({
    ...row,
    orders: row.orders.size,
    costPerOrder: row.orders.size ? row.practicalShippingCost / row.orders.size : 0,
  }));

  // The canonical P&L engine aggregates shipment rows to the order before
  // applying MAX(freight, unbilled). Reuse that result for the report total
  // so this intelligence view cannot disagree with the Profit page.
  return {
    rows,
    totalFreight: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.freight, 0),
    unbilled: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.unbilled, 0),
    practicalShippingCost: raw.result.shipping,
    totalForwardShipping: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.forward, 0),
    totalRtoShipping: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.rto, 0),
    totalCodCharges: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.cod, 0),
    gst: [...byOrderAndCourier.values()].reduce((sum, row) => sum + row.gst, 0),
  };
}

export async function getRtoIntelligence(businessId: string, start: string, end: string, filters: AnalyticsFilters = {}) {
  const raw = await getRawForAnalytics(businessId, start, end, filters);
  const rtoOrders = raw.orders.filter((order: any) => rtoStatus(order.status));
  const totalsBy = (selector: (order: any) => string[]) => {
    const map = new Map<string, { total: number; rto: number; value: number }>();
    for (const order of raw.orders) {
      for (const dimension of new Set(selector(order).filter(Boolean))) {
        const label = dimension || "Unknown";
        const row = map.get(label) ?? { total: 0, rto: 0, value: 0 };
        row.total += 1;
        if (rtoStatus(order.status)) {
          row.rto += 1;
          row.value += Number(order.gross_sale ?? 0);
        }
        map.set(label, row);
      }
    }
    return [...map.entries()]
      .map(([label, row]) => ({ label, total: row.total, count: row.rto, rtoValue: row.value, rtoRate: row.total ? row.rto / row.total : 0 }))
      .sort((a, b) => b.rtoRate - a.rtoRate || b.count - a.count);
  };
  const productGroups = totalsBy((order) => (order.order_items ?? []).map((item: any) => item.product_title || "Unknown"));
  const byState = totalsBy((order) => [order.shipping_state]);
  const byPincode = totalsBy((order) => [order.shipping_pincode]);
  const byCourier = totalsBy((order) => {
    const values = (order.shipping_orders ?? []).map((item: any) => item.courier_name).filter(Boolean);
    return values.length ? values : [order.shipping_courier];
  });
  const byPayment = totalsBy((order) => [order.payment_method]);
  return {
    count: rtoOrders.length,
    value: rtoOrders.reduce((sum: number, order: any) => sum + Number(order.gross_sale ?? 0), 0),
    rate: raw.orders.length ? rtoOrders.length / raw.orders.length : 0,
    byState,
    byPincode,
    byCourier,
    byPayment,
    byProduct: productGroups,
    highRiskPincodes: byPincode.filter((row) => row.total >= 5).slice(0, 20),
  };
}

export async function getCohorts(businessId: string, start: string, end: string, filters: AnalyticsFilters = {}) {
  const raw = await getRawForAnalytics(businessId, start, end, filters);
  const map = new Map<string, any>();
  for (const order of raw.orders) {
    const cohort = new Date(order.pickup_date ?? order.order_date).toISOString().slice(0, 10);
    const economics = raw.economicsByOrder.get(order.id);
    const row = map.get(cohort) ?? { cohort, orders: 0, revenue: 0, delivered: 0, rto: 0, profit: 0, marketingCost: 0, shipping: 0, cogs: 0, deliveredRevenue: 0 };
    row.orders += 1;
    row.revenue += Number(order.gross_sale ?? 0);
    if (economics?.effectiveDelivered) {
      row.delivered += 1;
      row.deliveredRevenue += economics.deliveredRevenue;
    }
    if (economics?.effectiveStatus === "RTO") row.rto += 1;
    row.profit += economics?.contributionBeforeMarketing ?? 0;
    row.shipping += economics?.shipping ?? 0;
    row.cogs += economics?.cogs ?? 0;
    map.set(cohort, row);
  }
  for (const row of map.values()) {
    row.marketingCost = raw.result.deliveredRevenue
      ? raw.metaEffectiveMarketingCost * row.deliveredRevenue / raw.result.deliveredRevenue
      : 0;
    row.profit -= row.marketingCost;
  }
  return [...map.values()]
    .sort((a, b) => b.cohort.localeCompare(a.cohort))
     .map(({ deliveredRevenue: _deliveredRevenue, ...row }) => ({
      ...row,
      deliveryRate: row.orders ? row.delivered / row.orders : 0,
      rtoRate: row.orders ? row.rto / row.orders : 0,
    }));
}

export async function getReconciliationSummary(businessId: string, start: string, end: string) {
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const [shopify, shipping, checkout, marketing] = await Promise.all([
    supabase.from("orders").select("id,external_order_id,order_number").eq("business_id", businessId).eq("provider", "shopify").gte("order_date", `${start}T00:00:00Z`).lte("order_date", `${end}T23:59:59Z`).range(0, 9999),
    supabase.from("shipping_orders").select("external_order_id,order_id,orders(external_order_id,order_number)").eq("business_id", businessId).range(0, 9999),
    supabase.from("checkout_transactions").select("order_id,order_number,orders(external_order_id,order_number)").eq("business_id", businessId).gte("transaction_date", `${start}T00:00:00Z`).lte("transaction_date", `${end}T23:59:59Z`).range(0, 9999),
    supabase.from("marketing_spend").select("date,spend").eq("business_id", businessId).gte("date", start).lte("date", end).range(0, 9999),
  ]);
  for (const query of [shopify, shipping, checkout, marketing]) if (query.error) throw new Error(query.error.message);

  const canonical = (order: any) => new Set([key(order.external_order_id), key(order.order_number), key(order.id)].filter(Boolean));
  const shippingKeys = new Set<string>();
  for (const row of (shipping.data ?? []) as any[]) {
    for (const value of [row.external_order_id, row.order_id, row.orders?.external_order_id, row.orders?.order_number]) if (key(value)) shippingKeys.add(key(value));
  }
  const checkoutKeys = new Set<string>();
  for (const row of (checkout.data ?? []) as any[]) {
    for (const value of [row.order_number, row.order_id, row.orders?.external_order_id, row.orders?.order_number]) if (key(value)) checkoutKeys.add(key(value));
  }

  const uniqueShopifyOrders = new Set((shopify.data ?? []).map((row: any) => key(row.external_order_id) || key(row.order_number)).filter(Boolean));
  const duplicateCount = (shopify.data ?? []).length - uniqueShopifyOrders.size;
  let shippingMatched = 0;
  let checkoutMatched = 0;
  for (const order of shopify.data ?? []) {
    const matchedKeys = canonical(order);
    if ([...matchedKeys].some((value) => shippingKeys.has(value))) shippingMatched += 1;
    if ([...matchedKeys].some((value) => checkoutKeys.has(value))) checkoutMatched += 1;
  }

  return {
    shopifyOrders: shopify.data?.length ?? 0,
    uniqueOrders: uniqueShopifyOrders.size,
    duplicates: duplicateCount,
    shippingMatched,
    shippingUnmatched: Math.max(0, uniqueShopifyOrders.size - shippingMatched),
    checkoutMatched,
    checkoutUnmatched: Math.max(0, uniqueShopifyOrders.size - checkoutMatched),
    metaRows: marketing.data?.length ?? 0,
    metaSpend: (marketing.data ?? []).reduce((sum: number, row: any) => sum + Number(row.spend ?? 0), 0),
  };
}
