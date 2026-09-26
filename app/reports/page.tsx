import Link from "next/link";
import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlobalFilters } from "@/components/dashboard/global-filters";
import { CsvImporter } from "@/components/forms/csv-importer";
import { getBusinessContext } from "@/lib/auth/business-context";
import { getMemberships } from "@/lib/auth/require-user";
import { calculateBusinessPeriodProfit } from "@/lib/profit-engine/server";
import { getReconciliationSummary, getRtoIntelligence } from "@/lib/analytics/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const ctx = await getBusinessContext(typeof q.business === "string" ? q.business : null);
  const memberships = await getMemberships();
  const { range, filters } = analyticsQuery(q);
  const [d, rec, rto] = await Promise.all([
    calculateBusinessPeriodProfit(ctx.businessId, range.start, range.end, undefined, filters),
    getReconciliationSummary(ctx.businessId, range.start, range.end),
    getRtoIntelligence(ctx.businessId, range.start, range.end, filters),
  ]);
  const openPipeline = (d.result.orderEconomics ?? [])
    .filter((x: any) => x.effectiveStatus === "OPEN")
    .reduce((sum: number, x: any) => sum + Number(x.grossSale ?? 0), 0);

  return <AppShell title="Reports" businessName={ctx.business?.name} role={ctx.role}>
    <PageHeader title="Reports & reconciliation" description="Export source-level CSV reports and inspect unmatched/duplicate records instead of hiding them." />
    <GlobalFilters businessId={ctx.businessId} memberships={memberships} />
    <div className="mb-4 flex flex-wrap gap-2">
      <Link className="rounded-md border bg-white px-3 py-1.5 text-[11px]" href={`/api/reports/export?businessId=${ctx.businessId}&start=${range.start}&end=${range.end}&type=profit`}>Export P&L CSV</Link>
      <Link className="rounded-md border bg-white px-3 py-1.5 text-[11px]" href={`/api/reports/export?businessId=${ctx.businessId}&start=${range.start}&end=${range.end}&type=orders`}>Export Orders CSV</Link>
      <Link className="rounded-md border bg-white px-3 py-1.5 text-[11px]" href={`/api/reports/export?businessId=${ctx.businessId}&start=${range.start}&end=${range.end}&type=products`}>Export Products CSV</Link><Link className="rounded-md border bg-white px-3 py-1.5 text-[11px]" href={`/api/reports/export?businessId=${ctx.businessId}&start=${range.start}&end=${range.end}&type=forecast`}>Export Forecast CSV</Link>
    </div>
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      {[
        ["Shopify Orders", formatNumber(rec.shopifyOrders)],
        ["Unique Orders", formatNumber(rec.uniqueOrders)],
        ["Duplicates", formatNumber(rec.duplicates)],
        ["Shipping Matched", formatNumber(rec.shippingMatched)],
        ["Shipping Unmatched", formatNumber(rec.shippingUnmatched)],
        ["Checkout Unmatched", formatNumber(rec.checkoutUnmatched)],
      ].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4"><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>)}
    </div>
    <div className="mt-5 rounded-lg border bg-white p-4">
      <div className="text-xs font-semibold">Revenue reconciliation</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5 text-xs">
        <span>Shopify Gross Sales <b>{formatCurrency(d.result.grossSale)}</b></span>
        <span>Delivered Revenue <b>{formatCurrency(d.result.deliveredRevenue)}</b></span>
        <span>RTO Value <b>{formatCurrency(rto.value)}</b></span>
        <span>Open Pipeline <b>{formatCurrency(openPipeline)}</b></span>
        <span>Net Profit <b>{formatCurrency(d.result.netProfit)}</b></span>
      </div>
    </div>
    <div className="mt-5"><CsvImporter businessId={ctx.businessId} /></div>
  </AppShell>;
}
