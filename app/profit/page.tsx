import { AppShell } from "@/components/dashboard/layout";
import { KPI } from "@/components/dashboard/kpi";
import { getBusinessContext } from "@/lib/auth/business-context";
import { calculateBusinessPeriodProfit, calculateDailyTrend } from "@/lib/profit-engine/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/format";
import { ProfitTrend } from "@/components/charts/profit-trend";
import { ProfitSimulator } from "@/components/forms/profit-simulator";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const ctx = await getBusinessContext(typeof q.business === "string" ? q.business : null);
  const { range, filters } = analyticsQuery(q);
  const [{ result: d }, trend] = await Promise.all([
    calculateBusinessPeriodProfit(ctx.businessId, range.start, range.end, undefined, filters),
    calculateDailyTrend(ctx.businessId, range.start, range.end, undefined, filters),
  ]);
  const tab = (label: string, preset?: string) => {
    const href = "?business=" + ctx.businessId + (preset ? "&preset=" + preset : "");
    return <a className={"module-tab" + (preset ? "" : " active")} href={href}>{label}</a>;
  };
  return (
    <AppShell title="Profit" businessName={ctx.business?.name} role={ctx.role}>
      <div className="module-head"><div><div className="module-title">Profit</div><div className="module-desc">Why did profit move?</div></div><div className="module-controls"><a className="top-btn" href={"/api/reports/export?businessId=" + ctx.businessId + "&start=" + range.start + "&end=" + range.end + "&type=profit"}>Export</a></div></div>
      <div className="module-tabbar">{tab("Daily")}{tab("7D","7d")}{tab("14D","14d")}{tab("30D","30d")}{tab("Monthly","month")}<span className="module-tab">Custom range</span></div>
      <div className="grid-12">
        <div className="span-3"><KPI label="GROSS SALE" value={d.grossSale} level1 /></div>
        <div className="span-3"><KPI label="NET SALE (SHIPPED)" value={d.netSaleShipped} level1 /></div>
        <div className="span-3"><KPI label="DELIVERED REVENUE" value={d.deliveredRevenue} level1 /></div>
        <div className="span-3"><KPI label="NET PROFIT" value={d.netProfit} level1 /></div>
        <div className="span-3"><KPI label="COGS" value={d.cogs} secondary /></div>
        <div className="span-3"><KPI label="SHIPPING" value={d.shipping} secondary /></div>
        <div className="span-3"><KPI label="CHECKOUT" value={d.checkout} secondary /></div>
        <div className="span-3"><KPI label="PG" value={d.pg} secondary /></div>
      </div>
      <div className="mt-3 grid-12">
        <div className="card chart-card span-8"><div className="card-head"><div><div className="card-title">Profit trend</div><div className="card-subtitle">Daily series for the selected period · {range.start} to {range.end}</div></div></div><ProfitTrend data={trend} /></div>
        <div className="card breakdown span-4"><div className="card-head"><div><div className="card-title">P&amp;L</div><div className="card-subtitle">Where did the money go?</div></div></div>
          <div className="breakdown-list">
            {[["Gross Sale", d.grossSale], ["Net Sale (Shipped)", d.netSaleShipped], ["Delivered Revenue", d.deliveredRevenue], ["COGS", -d.cogs], ["Shipping", -d.shipping], ["Checkout", -d.checkout], ["PG", -d.pg], ["Meta Spend", -d.metaSpend], ["Meta GST", -d.metaGst]].map(([label, value]) => <div className="breakdown-row" key={String(label)}><span className="breakdown-label">{label}</span><span className="breakdown-value">{formatCurrency(Number(value))}</span></div>)}
          </div>
          <div className="breakdown-total"><span className="label">NET PROFIT</span><span className="value">{formatCurrency(d.netProfit)}</span></div>
        </div>
      </div>
      <div className="section"><div className="section-head"><div className="section-title">Profit diagnostics</div><div className="section-note">Factual numerical observations only</div></div><div className="card diagnostics"><div className="diag-grid">
        <div className="diag-item"><div className="diag-label">Orders</div><div className="diag-copy">{formatNumber(d.orders)} orders in the selected period.</div></div>
        <div className="diag-item"><div className="diag-label">Delivery</div><div className="diag-copy">{formatPercent(d.deliveryRate)} effective delivery rate and {formatPercent(d.rtoRate)} RTO rate.</div></div>
        <div className="diag-item"><div className="diag-label">Marketing</div><div className="diag-copy">{formatCurrency(d.effectiveMarketingCost)} effective marketing cost including configured Meta GST.</div></div>
      </div></div></div>
      <div className="mt-3"><ProfitSimulator actual={d} targetProfit={Number(ctx.business?.settings?.target_profit ?? 0) || null} /></div>
    </AppShell>
  );
}
