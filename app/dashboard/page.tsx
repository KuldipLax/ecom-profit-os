import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KPI } from "@/components/dashboard/kpi";
import { GlobalFilters } from "@/components/dashboard/global-filters";
import { SourceProfitTrend } from "@/components/charts/source-profit-trend";
import { OrderHealth } from "@/components/dashboard/order-health";
import { DataHealth } from "@/components/dashboard/data-health";
import { DataMaturity } from "@/components/dashboard/data-maturity";
import { ProfitDiagnostics } from "@/components/dashboard/profit-diagnostics";
import { getBusinessContext } from "@/lib/auth/business-context";
import { getMemberships } from "@/lib/auth/require-user";
import { calculateBusinessPeriodProfit, calculateDailyTrend, getDataHealth } from "@/lib/profit-engine/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import Link from "next/link";

const growth = (current: number, prior: number) => prior === 0 ? 0 : ((current - prior) / Math.abs(prior)) * 100;

function signedPercent(value: number) {
  return value === 0 ? "0%" : `${Math.abs(value).toFixed(1)}%`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const ctx = await getBusinessContext(typeof q.business === "string" ? q.business : null);
  const memberships = await getMemberships();
  const { range, filters } = analyticsQuery(q);

  const currentStart = new Date(`${range.start}T00:00:00Z`);
  const currentEnd = new Date(`${range.end}T00:00:00Z`);
  const days = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1);
  const priorStart = new Date(currentStart);
  priorStart.setUTCDate(priorStart.getUTCDate() - days);
  const priorEnd = new Date(currentStart);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);

  const [period, trend, health, prior] = await Promise.all([
    calculateBusinessPeriodProfit(ctx.businessId, range.start, range.end, undefined, filters),
    calculateDailyTrend(ctx.businessId, range.start, range.end, undefined, filters),
    getDataHealth(ctx.businessId),
    calculateBusinessPeriodProfit(ctx.businessId, priorStart.toISOString().slice(0, 10), priorEnd.toISOString().slice(0, 10), undefined, filters),
  ]);

  const d = period.result;
  const p = prior.result;
  const moneyChange = (now: number, prev: number) => growth(now, prev);
  const deliveryChange = (d.deliveryRate - p.deliveryRate) * 100;
  const rtoChange = (d.rtoRate - p.rtoRate) * 100;

  const chartRows = trend.map((row: any) => ({
    ...row,
    deliveryRate: d.orders ? d.deliveryRate * 100 : 0,
    rtoRate: d.orders ? d.rtoRate * 100 : 0,
  }));

  return (
    <AppShell title="Dashboard" businessName={ctx.business?.name} role={ctx.role}>
      <PageHeader
        title="Dashboard"
        description="A focused view of what happened across revenue, profit, orders and operations."
        actions={<span className="estimate">{d.orders ? "Live data" : "No data connected"}</span>}
      />

      <GlobalFilters businessId={ctx.businessId} memberships={memberships} />

      {d.orders === 0 ? (
        <section className="section">
          <div className="card card-pad">
            <div className="card-title">No data yet</div>
            <div className="module-desc" style={{ lineHeight: 1.55, marginTop: 6 }}>
              Connect a source or add an order to populate this dashboard. No synthetic metrics are shown.
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-start" }}>
              <Link href="/settings" className="primary-btn">Open Settings</Link>
              <Link href="/orders" className="secondary-btn">Add / import orders</Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <div className="section-title">Primary business KPIs</div>
              <div className="section-note">Level 1 · decision signals</div>
            </div>
            <div className="grid-12">
              <div className="span-3">
                <KPI
                  label="NET PROFIT"
                  value={d.netProfit}
                  level1
                  metric="Profit margin"
                  change={signedPercent(moneyChange(d.netProfit, p.netProfit))}
                  positive={d.netProfit >= p.netProfit}
                  note={`vs previous period · ${formatCurrency(p.netProfit)} last period`}
                />
              </div>
              <div className="span-3">
                <KPI
                  label="DELIVERED REVENUE"
                  value={d.deliveredRevenue}
                  level1
                  metric="Delivered orders"
                  change={signedPercent(moneyChange(d.deliveredRevenue, p.deliveredRevenue))}
                  positive={d.deliveredRevenue >= p.deliveredRevenue}
                  note={`${formatNumber(d.effectiveDelivered)} delivered orders`}
                />
              </div>
              <div className="span-3">
                <KPI
                  label="GROSS SALE"
                  value={d.grossSale}
                  level1
                  metric="Total orders"
                  change={signedPercent(moneyChange(d.grossSale, p.grossSale))}
                  positive={d.grossSale >= p.grossSale}
                  note={`${formatNumber(d.orders)} total orders`}
                />
              </div>
              <div className="span-3">
                <KPI
                  label="ORDERS"
                  value={d.orders}
                  kind="number"
                  level1
                  metric="Delivered"
                  change={signedPercent(moneyChange(d.orders, p.orders))}
                  positive={d.orders >= p.orders}
                  note={`Delivered ${formatNumber(d.effectiveDelivered)} · RTO ${formatNumber(d.rto)} · Open ${formatNumber(d.open)}`}
                />
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div className="section-title">Business health</div>
              <div className="section-note">Level 2 · operational signals</div>
            </div>
            <div className="grid-12">
              <div className="span-3">
                <KPI
                  label="DELIVERY RATE"
                  value={d.deliveryRate}
                  kind="percent"
                  secondary
                  metric="vs previous period"
                  change={signedPercent(deliveryChange)}
                  positive={deliveryChange >= 0}
                  note="Delivered ÷ fulfilled orders"
                />
              </div>
              <div className="span-3">
                <KPI
                  label="RTO RATE"
                  value={d.rtoRate}
                  kind="percent"
                  secondary
                  metric="vs previous period"
                  change={signedPercent(rtoChange)}
                  positive={rtoChange <= 0}
                  note="RTO ÷ fulfilled orders"
                />
              </div>
              <div className="span-3">
                <KPI
                  label="EFFECTIVE MARKETING COST"
                  value={d.effectiveMarketingCost}
                  secondary
                  metric="vs previous period"
                  change={signedPercent(moneyChange(d.effectiveMarketingCost, p.effectiveMarketingCost))}
                  positive={d.effectiveMarketingCost <= p.effectiveMarketingCost}
                  note="Meta spend + GST"
                />
              </div>
              <div className="span-3">
                <KPI
                  label="ROAS"
                  value={d.roas}
                  kind="x"
                  secondary
                  metric="vs previous period"
                  change={signedPercent(moneyChange(d.roas, p.roas))}
                  positive={d.roas >= p.roas}
                  note="Delivered revenue ÷ marketing cost"
                />
              </div>
            </div>
          </section>

          <section className="section">
            <div className="grid-12">
              <div className="card chart-card span-8">
                <div className="card-head">
                  <div>
                    <div className="card-title">Sales, Profit &amp; Cost Trend</div>
                    <div className="card-subtitle">Daily series for the selected period.</div>
                  </div>
                  <div className="chart-tools">
                    {["Gross Sale", "Delivered Revenue", "Net Profit", "Marketing Cost", "RTO Rate", "Delivery Rate"].map((label, index) => (
                      <button key={label} type="button" className={`chart-pill ${index < 3 ? "active" : ""}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <SourceProfitTrend data={chartRows} />
                <div className="legend">
                  <span><i className="legend-dot" style={{ background: "#aeb5bd" }} /> Gross Sale</span>
                  <span><i className="legend-dot" style={{ background: "#6f95be" }} /> Delivered Revenue</span>
                  <span><i className="legend-dot" style={{ background: "#1f252b" }} /> Net Profit</span>
                  <span><i className="legend-dot" style={{ background: "#c69d63" }} /> Marketing Cost</span>
                  <span><i className="legend-dot" style={{ background: "#c46f73" }} /> RTO Rate</span>
                  <span><i className="legend-dot" style={{ background: "#5e9c79" }} /> Delivery Rate</span>
                </div>
              </div>

              <div className="card breakdown span-4">
                <div className="card-head">
                  <div>
                    <div className="card-title">Profit Breakdown</div>
                    <div className="card-subtitle">Where did the money go?</div>
                  </div>
                  <span style={{ color: "#a1a5a9" }}>···</span>
                </div>
                <div className="breakdown-list">
                  <div className="breakdown-row"><span className="breakdown-label">Gross Sale</span><span className="breakdown-value">{formatCurrency(d.grossSale)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">Delivered Revenue</span><span className="breakdown-value">{formatCurrency(d.deliveredRevenue)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">COGS</span><span className="breakdown-value">− {formatCurrency(d.cogs)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">Shipping</span><span className="breakdown-value">− {formatCurrency(d.shipping)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">Checkout</span><span className="breakdown-value">− {formatCurrency(d.checkout)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">PG</span><span className="breakdown-value">− {formatCurrency(d.pg)}</span></div>
                  <div className="breakdown-row drill"><span className="breakdown-label">Meta + GST</span><span className="breakdown-value">− {formatCurrency(d.effectiveMarketingCost)}</span></div>
                </div>
                <div className="breakdown-total"><span className="label">NET PROFIT</span><span className="value">{formatCurrency(d.netProfit)}</span></div>
                <div className="small-note" style={{ marginTop: 9 }}>Click a cost line to open its investigation module.</div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <div className="section-title">Operational intelligence</div>
              <div className="section-note">Level 3 · investigate what is moving the numbers</div>
            </div>
            <div className="grid-12">
              <div className="span-4"><OrderHealth data={d} /></div>
              <div className="span-4">
                <div className="card operational">
                  <div className="card-head"><div><div className="card-title">Data Health</div><div className="card-subtitle">Source integrity and missing cost coverage.</div></div></div>
                  <div className="metric-list">
                    <div className="metric-row"><span>Health score</span><strong>{formatNumber(health.score)}</strong></div>
                    <div className="metric-row"><span>Duplicate IDs</span><strong>{formatNumber(health.duplicateOrderNumbers)}</strong></div>
                    <div className="metric-row"><span>Open status</span><strong>{formatNumber(health.unresolvedStatus)}</strong></div>
                    <div className="metric-row"><span>Missing shipping</span><strong>{formatNumber(health.missingShipping)}</strong></div>
                    <div className="metric-row"><span>Missing COGS</span><strong>{formatNumber(health.missingCogs)}</strong></div>
                  </div>
                  <div style={{ marginTop: 10 }}><Link href="/reports" className="table-cta">View data health →</Link></div>
                </div>
              </div>
              <div className="span-4">
                <div className="card operational">
                  <div className="card-head"><div><div className="card-title">RTO Intelligence</div><div className="card-subtitle">Strongest current risk signal.</div></div></div>
                  <div className="pipeline-box"><div className="pipeline-label">RTO Rate</div><div className="pipeline-value">{formatPercent(d.rtoRate)}</div></div>
                  <div className="metric-list">
                    <div className="metric-row"><span>RTO Orders</span><strong>{formatNumber(d.rto)}</strong></div>
                    <div className="metric-row"><span>Open Orders</span><strong>{formatNumber(d.open)}</strong></div>
                    <div className="metric-row"><span>Shipped Orders</span><strong>{formatNumber(d.shipped)}</strong></div>
                    <div className="metric-row"><span>Delivered Orders</span><strong>{formatNumber(d.effectiveDelivered)}</strong></div>
                  </div>
                  <div style={{ marginTop: 10 }}><Link href="/rto" className="table-cta">View RTO →</Link></div>
                </div>
              </div>
            </div>
          </section>

          <DataMaturity open={d.open} from={range.start} to={range.end} />

          <section className="section">
            <div className="section-head">
              <div className="section-title">Business Diagnostics</div>
              <div className="section-note">Factual numerical observations only</div>
            </div>
            <ProfitDiagnostics items={[
              `RTO rate is ${formatPercent(d.rtoRate)} for the selected period, versus ${formatPercent(p.rtoRate)} in the previous period.`,
              `Shipping cost is ${formatCurrency(d.shipping)} against delivered revenue of ${formatCurrency(d.deliveredRevenue)}.`,
              `Effective marketing cost is ${formatCurrency(d.effectiveMarketingCost)} including configured Meta GST.`,
            ]} />
          </section>
        </>
      )}
    </AppShell>
  );
}
