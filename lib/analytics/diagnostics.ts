import type { PeriodProfit } from "@/lib/profit-engine/types";

const pct = (current: number, prior: number) => prior === 0 ? (current === 0 ? 0 : 1) : (current - prior) / prior;
const pp = (current: number, prior: number) => (current - prior) * 100;
const roundPct = (v: number) => Math.round(v * 1000) / 10;

export function buildProfitDiagnostics(current: PeriodProfit, prior: PeriodProfit | null) {
  if (!prior || (current.orders === 0 && prior.orders === 0)) return [] as string[];
  const out: string[] = [];
  const revenueGrowth = pct(current.deliveredRevenue, prior.deliveredRevenue);
  const shippingGrowth = pct(current.shipping, prior.shipping);
  const marketingGrowth = pct(current.effectiveMarketingCost, prior.effectiveMarketingCost);
  const deliveredGrowth = pct(current.deliveredRevenue, prior.deliveredRevenue);
  const profitChange = current.netProfit - prior.netProfit;

  if (Math.abs(revenueGrowth) >= 0.05 && Math.abs(shippingGrowth) >= 0.05) {
    out.push(`Delivered Revenue ${revenueGrowth >= 0 ? "increased" : "decreased"} ${Math.abs(roundPct(revenueGrowth))}% while Shipping ${shippingGrowth >= 0 ? "increased" : "decreased"} ${Math.abs(roundPct(shippingGrowth))}%.`);
  }
  const rtoChange = pp(current.rtoRate, prior.rtoRate);
  if (Math.abs(rtoChange) >= 2) {
    out.push(`RTO rate ${rtoChange >= 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(rtoChange * 10) / 10)} percentage points (${Math.round(prior.rtoRate * 1000) / 10}% → ${Math.round(current.rtoRate * 1000) / 10}%).`);
  }
  if (Math.abs(marketingGrowth) >= 0.05 && Math.abs(deliveredGrowth) < 0.05) {
    out.push(`Effective Marketing Cost ${marketingGrowth >= 0 ? "increased" : "decreased"} ${Math.abs(roundPct(marketingGrowth))}% while Delivered Revenue was broadly flat.`);
  }
  if (Math.abs(profitChange) > 0 && Math.abs(revenueGrowth) >= 0.05) {
    out.push(`Net Profit changed by ₹${Math.abs(profitChange).toLocaleString("en-IN", { maximumFractionDigits: 2 })} while Delivered Revenue ${revenueGrowth >= 0 ? "moved up" : "moved down"} ${Math.abs(roundPct(revenueGrowth))}%.`);
  }
  if (current.orders > 0 && current.effectiveDelivered > 0 && current.marketingCostPerDeliveredOrder > 0) {
    out.push(`Marketing Cost per Delivered Order is ₹${current.marketingCostPerDeliveredOrder.toLocaleString("en-IN", { maximumFractionDigits: 2 })}.`);
  }
  return out.slice(0, 5);
}
