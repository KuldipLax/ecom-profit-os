import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KPI } from "@/components/dashboard/kpi";
import { ProfitTrend } from "@/components/charts/profit-trend";
import { GlobalFilters } from "@/components/dashboard/global-filters";
import { getBusinessContext } from "@/lib/auth/business-context";
import { getMemberships } from "@/lib/auth/require-user";
import { calculateBusinessPeriodProfit, getDataHealth } from "@/lib/profit-engine/server";
import { getProductProfitability, getRtoIntelligence, getForwardOrders } from "@/lib/analytics/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils/format";
import { calculateDailyTrend } from "@/lib/profit-engine/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const ctx = await getBusinessContext(typeof q.business === "string" ? q.business : null);
  const memberships = await getMemberships();
  const { range, filters } = analyticsQuery(q);

  const [period, trend, products, rto, forward, prior] = await Promise.all([
    calculateBusinessPeriodProfit(ctx.businessId, range.start, range.end, undefined, filters),
    calculateDailyTrend(ctx.businessId, range.start, range.end, undefined, filters),
    getProductProfitability(ctx.businessId, range.start, range.end, filters),
    getRtoIntelligence(ctx.businessId, range.start, range.end, filters),
    getForwardOrders(ctx.businessId, range.start, range.end, filters),
    calculateBusinessPeriodProfit(ctx.businessId, (() => { const x = new Date(range.start + "T00:00:00Z"); const days = Math.max(1, Math.round((new Date(range.end + "T00:00:00Z").getTime() - x.getTime()) / 86400000) + 1); x.setUTCDate(x.getUTCDate() - days); return x.toISOString().slice(0, 10); })(), new Date(new Date(range.start + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10), undefined, filters),
  ]);

  const d = period.result;
  const p = prior.result;
  const changePct = (a: number, b: number) => b === 0 ? 0 : Math.abs(((a - b) / Math.abs(b)) * 100);
  const isUpGood = (a: number, b: number, invert = false) => invert ? a <= b : a >= b;
  const topProducts = products.slice(0, 5);
  const topRtoState = rto.byState[0]?.label ?? "—";
  const topRtoPincode = rto.byPincode[0]?.label ?? "—";
  const topRtoCourier = rto.byCourier[0]?.label ?? "—";
  const forwardRevenue = forward.reduce((s, o: any) => s + Number(o.gross_sale ?? 0), 0);

  return (
    <AppShell title="Dashboard" businessName={ctx.business?.name} role={ctx.role}>
      <PageHeader title="Dashboard" description="A focused view of what happened across revenue, profit, orders and operations." />
      <GlobalFilters businessId={ctx.businessId} memberships={memberships} />

      <section className="section">
        <div className="section-head"><div className="section-title">Primary business KPIs</div><div className="section-note">Level 1 · decision signals</div></div>
        <div className="grid-12">
          <div className="span-3"><KPI label="NET PROFIT" value={d.netProfit} level1 metric="Profit margin" change={changePct(d.netProfit,p.netProfit).toFixed(1) + "%"} positive={isUpGood(d.netProfit,p.netProfit)} /></div>
          <div className="span-3"><KPI label="DELIVERED REVENUE" value={d.deliveredRevenue} level1 metric="Delivered orders" change={changePct(d.deliveredRevenue,p.deliveredRevenue).toFixed(1) + "%"} positive={isUpGood(d.deliveredRevenue,p.deliveredRevenue)} note={formatNumber(d.effectiveDelivered) + " delivered orders"} /></div>
          <div className="span-3"><KPI label="GROSS SALE" value={d.grossSale} level1 metric="Total orders" change={changePct(d.grossSale,p.grossSale).toFixed(1) + "%"} positive={isUpGood(d.grossSale,p.grossSale)} note={formatNumber(d.orders) + " total orders"} /></div>
          <div className="span-3"><KPI label="ORDERS" value={d.orders} kind="number" level1 metric="Delivered" change={changePct(d.orders,p.orders).toFixed(1) + "%"} positive={isUpGood(d.orders,p.orders)} note={"Delivered " + formatNumber(d.effectiveDelivered) + " · RTO " + formatNumber(d.rto) + " · Open " + formatNumber(d.open)} /></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div className="section-title">Business health</div><div className="section-note">Level 2 · operational signals</div></div>
        <div className="grid-12">
          <div className="span-3"><KPI label="DELIVERY RATE" value={d.deliveryRate} kind="percent" secondary metric="vs previous period" change={changePct(d.deliveryRate,p.deliveryRate).toFixed(1) + "%"} positive={isUpGood(d.deliveryRate,p.deliveryRate)} note="Delivered ÷ fulfilled orders" /></div>
          <div className="span-3"><KPI label="RTO RATE" value={d.rtoRate} kind="percent" secondary metric="vs previous period" change={changePct(d.rtoRate,p.rtoRate).toFixed(1) + "%"} positive={isUpGood(d.rtoRate,p.rtoRate,true)} note="RTO ÷ fulfilled orders" /></div>
          <div className="span-3"><KPI label="EFFECTIVE MARKETING COST" value={d.effectiveMarketingCost} secondary metric="vs previous period" change={changePct(d.effectiveMarketingCost,p.effectiveMarketingCost).toFixed(1) + "%"} positive={isUpGood(d.effectiveMarketingCost,p.effectiveMarketingCost,true)} note="Meta spend + GST" /></div>
          <div className="span-3"><KPI label="ROAS" value={d.roas} kind="x" secondary metric="vs previous period" change={changePct(d.roas,p.roas).toFixed(1) + "%"} positive={isUpGood(d.roas,p.roas)} note="Delivered revenue ÷ marketing cost" /></div>
        </div>
      </section>

      <section className="section">
        <div className="grid-12">
          <div className="card chart-card span-8">
            <div className="card-head"><div><div className="card-title">Sales, Profit &amp; Cost Trend</div><div className="card-subtitle">Daily series for the selected period.</div></div></div>
            <ProfitTrend data={trend} />
          </div>
          <div className="card breakdown span-4">
            <div className="card-head"><div><div className="card-title">Profit Breakdown</div><div className="card-subtitle">Where did the money go?</div></div><span style={{ color: "#a1a5a9" }}>···</span></div>
            <div className="breakdown-list">
              <div className="breakdown-row"><span className="breakdown-label">Gross Sale</span><span className="breakdown-value">{formatCurrency(d.grossSale)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">Delivered Revenue</span><span className="breakdown-value">{formatCurrency(d.deliveredRevenue)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">COGS</span><span className="breakdown-value">− {formatCurrency(d.cogs)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">Shipping</span><span className="breakdown-value">− {formatCurrency(d.shipping)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">Checkout</span><span className="breakdown-value">− {formatCurrency(d.checkout)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">PG</span><span className="breakdown-value">− {formatCurrency(d.pg)}</span></div>
              <div className="breakdown-row"><span className="breakdown-label">Meta + GST</span><span className="breakdown-value">− {formatCurrency(d.effectiveMarketingCost)}</span></div>
            </div>
            <div className="breakdown-total"><span className="label">NET PROFIT</span><span className="value">{formatCurrency(d.netProfit)}</span></div>
            <div className="small-note" style={{ marginTop: 9 }}>Click a cost line to open its investigation module.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div className="section-title">Operational intelligence</div><div className="section-note">Level 3 · investigate what is moving the numbers</div></div>
        <div className="grid-12">
          <div className="card operational span-4">
            <div className="card-head"><div><div className="card-title">Order Health</div><div className="card-subtitle">Current fulfilled-order distribution.</div></div></div>
            <div className="metric-list">
              <div className="metric-row"><span>Shipped</span><strong>{d.shipped}</strong></div>
              <div className="metric-row"><span>Delivered</span><strong>{d.effectiveDelivered}</strong></div>
              <div className="metric-row"><span>RTO</span><strong>{d.rto}</strong></div>
              <div className="metric-row"><span>Open</span><strong>{d.open}</strong></div>
            </div>
            <div className="distribution"><span className="dist-seg seg-a" style={{ width: (d.orders ? Math.min(100, (d.shipped / d.orders) * 100) : 0) + "%" }} /><span className="dist-seg seg-b" style={{ width: (d.orders ? Math.min(100, (d.effectiveDelivered / d.orders) * 100) : 0) + "%" }} /><span className="dist-seg seg-c" style={{ width: (d.orders ? Math.min(100, (d.rto / d.orders) * 100) : 0) + "%" }} /></div>
            <div className="small-note">Delivery Rate {formatPercent(d.deliveryRate)} · RTO Rate {formatPercent(d.rtoRate)}</div>
          </div>

          <div className="card operational span-4">
            <div className="card-head"><div><div className="card-title">Forward Pipeline</div><div className="card-subtitle">Expected outcomes from forward orders.</div></div><span className="estimate">Estimate only</span></div>
            <div className="pipeline-top"><div className="pipeline-box"><div className="pipeline-label">Forward Orders</div><div className="pipeline-value">{forward.length}</div></div><div className="pipeline-box"><div className="pipeline-label">Projected Revenue</div><div className="pipeline-value">{formatCurrency(forwardRevenue)}</div></div></div>
            <div className="metric-list">
              <div className="metric-row"><span>In Transit</span><strong>{forward.filter((x: any) => x.status === "IN_TRANSIT").length}</strong></div>
              <div className="metric-row"><span>Reached Destination</span><strong>{forward.filter((x: any) => x.status === "REACHED_DESTINATION").length}</strong></div>
              <div className="metric-row"><span>Estimated Delivered</span><strong>—</strong></div>
              <div className="metric-row"><span>Estimated RTO</span><strong>—</strong></div>
              <div className="metric-row"><span>Estimated Additional Profit</span><strong>—</strong></div>
            </div>
          </div>

          <div className="card operational span-4">
            <div className="card-head"><div><div className="card-title">RTO Intelligence</div><div className="card-subtitle">Strongest current risk signal.</div></div></div>
            <div className="pipeline-box" style={{ marginTop: 8 }}><div className="pipeline-label">RTO Rate</div><div className="pipeline-value">{formatPercent(d.rtoRate)}</div></div>
            <div className="metric-list">
              <div className="metric-row"><span>RTO Value</span><strong>{formatCurrency(rto.value)}</strong></div>
              <div className="metric-row"><span>Top Risk State</span><strong>{topRtoState}</strong></div>
              <div className="metric-row"><span>Top Risk Pincode</span><strong>{topRtoPincode}</strong></div>
              <div className="metric-row"><span>Top Risk Courier</span><strong>{topRtoCourier}</strong></div>
            </div>
            <div style={{ marginTop: 10 }}><Link href={"/rto?business=" + ctx.businessId} className="table-cta">View RTO →</Link></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div className="section-title">Product performance</div><div className="section-note">Top 5 by delivered revenue</div></div>
        <div className="grid-12">
          <div className="card table-card span-8">
            <div className="table-toolbar"><div className="table-title">Product Performance</div><Link className="table-cta" href={"/products?business=" + ctx.businessId}>View All Products →</Link></div>
            <div className="table-wrap"><table><thead><tr>{["Product","Revenue","Orders","Delivered","RTO","COGS","Profit","Margin"].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>
              {topProducts.map((p: any) => <tr key={String(p.productId) + String(p.sku)}><td><strong>{p.title}</strong><div className="table-muted">{p.sku || "—"}</div></td><td>{formatCurrency(p.deliveredRevenue)}</td><td>{formatNumber(p.orders)}</td><td>{formatNumber(p.unitsDelivered)}</td><td>{formatNumber(p.rtoOrders)}</td><td>{formatCurrency(p.cogs)}</td><td>{formatCurrency(p.netProfit)}</td><td>{formatPercent(p.profitMargin)}</td></tr>)}
              {!topProducts.length && <tr><td colSpan={8}>No product data for the selected period.</td></tr>}
            </tbody></table></div>
          </div>
          <div className="card risk-card span-4">
            <div className="card-title">Business Risk</div>
            <div className="risk-item"><div className="risk-label">Highest RTO product</div><div className="risk-main"><strong>{products.slice().sort((a: any,b: any)=>b.rtoPercent-a.rtoPercent)[0]?.title ?? "—"}</strong><span>{products.length ? formatPercent(products.slice().sort((a: any,b: any)=>b.rtoPercent-a.rtoPercent)[0].rtoPercent) : "—"}</span></div></div>
            <div className="risk-item"><div className="risk-label">Lowest margin</div><div className="risk-main"><strong>{products.slice().sort((a: any,b: any)=>a.profitMargin-b.profitMargin)[0]?.title ?? "—"}</strong><span>{products.length ? formatPercent(products.slice().sort((a: any,b: any)=>a.profitMargin-b.profitMargin)[0].profitMargin) : "—"}</span></div></div>
            <div className="risk-item"><div className="risk-label">Highest revenue share</div><div className="risk-main"><strong>{products.slice().sort((a: any,b: any)=>b.deliveredRevenue-a.deliveredRevenue)[0]?.title ?? "—"}</strong><span>{d.deliveredRevenue ? formatPercent((products.slice().sort((a: any,b: any)=>b.deliveredRevenue-a.deliveredRevenue)[0]?.deliveredRevenue ?? 0) / d.deliveredRevenue) : "—"}</span></div></div>
            <div className="risk-item"><div className="risk-label">Risk state</div><div className="risk-main"><strong>{topRtoState}</strong><span>{rto.byState[0] ? formatPercent(rto.byState[0].rtoRate) + " RTO" : "—"}</span></div></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div className="section-title">Business Diagnostics</div><div className="section-note">Factual numerical observations only</div></div>
        <div className="card diagnostics"><div className="diag-grid">
          <div className="diag-item"><div className="diag-label">Diagnostic 01</div><div className="diag-copy">{formatNumber(d.rto)} RTO orders in the selected period, a {formatPercent(d.rtoRate)} RTO rate.</div></div>
          <div className="diag-item"><div className="diag-label">Diagnostic 02</div><div className="diag-copy">{formatCurrency(d.shipping)} shipping against {formatCurrency(d.deliveredRevenue)} delivered revenue.</div></div>
          <div className="diag-item"><div className="diag-label">Diagnostic 03</div><div className="diag-copy">{formatCurrency(d.effectiveMarketingCost)} effective marketing cost including configured Meta GST.</div></div>
        </div></div>
      </section>
    </AppShell>
  );
}
