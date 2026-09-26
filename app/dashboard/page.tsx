import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KPI } from "@/components/dashboard/kpi";
import { ProfitTrend } from "@/components/charts/profit-trend";
import { OrderHealth } from "@/components/dashboard/order-health";
import { DataHealth } from "@/components/dashboard/data-health";
import { DataMaturity } from "@/components/dashboard/data-maturity";
import { ProfitWaterfall } from "@/components/dashboard/profit-waterfall";
import { GlobalFilters } from "@/components/dashboard/global-filters";
import { SetupEmpty } from "@/components/dashboard/setup-empty";
import { getBusinessContext } from "@/lib/auth/business-context";
import { getMemberships } from "@/lib/auth/require-user";
import { calculateBusinessPeriodProfit, calculateDailyTrend, getDataHealth } from "@/lib/profit-engine/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { buildProfitDiagnostics } from "@/lib/analytics/diagnostics";
import { ProfitDiagnostics } from "@/components/dashboard/profit-diagnostics";

const growth = (current: number, prior: number) => prior === 0 ? 0 : (current - prior) / prior;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const ctx = await getBusinessContext(typeof q.business === "string" ? q.business : null);
  const memberships = await getMemberships();
  const { range, filters } = analyticsQuery(q);
  const priorStart = (() => { const d = new Date(`${range.start}T00:00:00Z`); const days = Math.max(1, Math.round((new Date(`${range.end}T00:00:00Z`).getTime() - d.getTime()) / 86400000) + 1); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); })();
  const priorEnd = (() => { const d = new Date(`${range.start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  const [period, trend, health, prior] = await Promise.all([
    calculateBusinessPeriodProfit(ctx.businessId, range.start, range.end, undefined, filters),
    calculateDailyTrend(ctx.businessId, range.start, range.end, undefined, filters),
    getDataHealth(ctx.businessId),
    calculateBusinessPeriodProfit(ctx.businessId, priorStart, priorEnd, undefined, filters),
  ]);
  const d = period.result;
  return <AppShell title="Dashboard" businessName={ctx.business?.name} role={ctx.role}>
    <PageHeader title="Profit command center" description="One accounting engine across orders, delivery, costs and period marketing." />
    <GlobalFilters businessId={ctx.businessId} memberships={memberships} />
    {d.orders === 0 ? <SetupEmpty /> : <>
      <DataMaturity open={d.open} from={range.start} to={range.end} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KPI label="Net Profit" value={d.netProfit}/><KPI label="Delivered Revenue" value={d.deliveredRevenue}/><KPI label="Gross Sale" value={d.grossSale}/><KPI label="Orders" value={d.orders} kind="number"/><KPI label="Delivery Rate" value={d.deliveryRate} kind="percent"/><KPI label="RTO Rate" value={d.rtoRate} kind="percent"/><KPI label="Marketing Cost" value={d.effectiveMarketingCost}/><KPI label="ROAS" value={d.roas} kind="x"/>
      </div>
      {prior && <div className="mt-4 rounded-lg border bg-white p-4"><div className="text-xs font-semibold">Period growth vs prior period</div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-xs"><span>Orders <b>{formatNumber(growth(d.orders,prior.result.orders)*100)}%</b></span><span>Gross Sales <b>{formatNumber(growth(d.grossSale,prior.result.grossSale)*100)}%</b></span><span>Delivered Revenue <b>{formatNumber(growth(d.deliveredRevenue,prior.result.deliveredRevenue)*100)}%</b></span><span>Profit change <b>{formatCurrency(d.netProfit-prior.result.netProfit)}</b></span><span>Delivery-rate change <b>{formatNumber((d.deliveryRate-prior.result.deliveryRate)*100)} pp</b></span><span>RTO-rate change <b>{formatNumber((d.rtoRate-prior.result.rtoRate)*100)} pp</b></span></div></div>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[2fr,1fr]"><div className="rounded-lg border bg-white p-4"><div className="mb-2 text-xs font-semibold">Sales, Profit & Cost Trend</div><ProfitTrend data={trend}/></div><OrderHealth data={d}/></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><ProfitWaterfall data={d}/><DataHealth data={health}/></div>
      <div className="mt-5"><ProfitDiagnostics items={buildProfitDiagnostics(d, prior?.result ?? null)}/></div>
    </>}
  </AppShell>;
}
