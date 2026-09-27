import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { KPI } from "@/components/dashboard/kpi";
import { ProfitWaterfall } from "@/components/dashboard/profit-waterfall";
import { getBusinessContext } from "@/lib/auth/business-context";
import { calculateBusinessPeriodProfit } from "@/lib/profit-engine/server";
import { analyticsQuery } from "@/lib/utils/query";
import { formatCurrency,formatPercent } from "@/lib/utils/format";
import { ProfitSimulator } from "@/components/forms/profit-simulator";

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const q=await searchParams;
  const ctx=await getBusinessContext(typeof q.business==="string"?q.business:null);
  const {range,filters}=analyticsQuery(q);
  const d=(await calculateBusinessPeriodProfit(ctx.businessId,range.start,range.end,undefined,filters)).result;
  return <AppShell title="Profit" businessName={ctx.business?.name} role={ctx.role}>
    <div className="module-head">
      <div><div className="module-title">Profit intelligence</div><div className="module-desc">Gross Sale ≠ Delivered Revenue ≠ Net Profit. Marketing is period-level, never artificially allocated to official order P&L.</div></div>
      <div className="module-controls"><a className="top-btn" href={`/api/reports/export?businessId=${ctx.businessId}&start=${range.start}&end=${range.end}&type=profit`}>Export</a></div>
    </div>
    <div className="module-tabbar"><a className="module-tab active" href={`?business=${ctx.businessId}`}>Daily</a><a className="module-tab" href={`?business=${ctx.businessId}&preset=7d`}>7D</a><a className="module-tab" href={`?business=${ctx.businessId}&preset=14d`}>14D</a><a className="module-tab" href={`?business=${ctx.businessId}&preset=30d`}>30D</a><a className="module-tab" href={`?business=${ctx.businessId}&preset=month`}>Monthly</a><span className="module-tab">Custom range</span></div>
    <div className="grid-12">
      {[
        ["Gross Sale",d.grossSale,"currency"],
        ["Net Sale (Shipped)",d.netSaleShipped,"currency"],
        ["Delivered Revenue",d.deliveredRevenue,"currency"],
        ["Net Profit",d.netProfit,"currency"],
        ["COGS",d.cogs,"currency"],
        ["Shipping",d.shipping,"currency"],
        ["Checkout",d.checkout,"currency"],
        ["PG",d.pg,"currency"]
      ].map(([label,value,kind],i)=><div className="span-3" key={String(label)}><KPI label={String(label)} value={Number(value)} kind={kind as any} level1={i<4} secondary={i>=4}/></div>)}
    </div>
    <div className="mt-3 grid-12">
      <div className="card breakdown span-8">
        <div className="card-head"><div><div className="card-title">Profit trend</div><div className="card-subtitle">Selected period · {range.start} to {range.end}</div></div></div>
        <div className="chart" style={{height:310}}><div className="chart-grid"/><div className="chart-line"><svg viewBox="0 0 1000 300" preserveAspectRatio="none"><path d="M0,255 C55,248 90,262 135,245 S205,250 248,226 S310,241 355,212 S420,224 470,195 S525,210 575,177 S635,193 680,162 S735,179 780,149 S845,159 895,128 S955,140 1000,111" fill="none" stroke="#22272b" strokeWidth="2.6"/></svg></div><div className="chart-axis-x"><span>{range.start.slice(5)}</span><span>{range.end.slice(5)}</span></div></div>
      </div>
      <div className="card breakdown span-4">
        <div className="card-title">P&amp;L</div>
        <div className="breakdown-list">
          {[["Gross Sale",d.grossSale],["Net Sale (Shipped)",d.netSaleShipped],["Delivered Revenue",d.deliveredRevenue],["COGS",-d.cogs],["Shipping",-d.shipping],["Checkout",-d.checkout],["PG",-d.pg],["Meta Spend + GST",-d.effectiveMarketingCost]].map(([label,v])=><div className="breakdown-row" key={String(label)}><span className="breakdown-label">{label}</span><span className="breakdown-value">{formatCurrency(Number(v))}</span></div>)}
        </div>
        <div className="breakdown-total"><span className="label">NET PROFIT</span><span className="value">{formatCurrency(d.netProfit)}</span></div>
      </div>
    </div>
    <div className="mt-3 grid-12">
      <div className="card breakdown span-8"><div className="card-title">Profit waterfall</div><div className="breakdown-list mt-2">{[
        ["Gross Sale",d.grossSale],["Effective Delivered Revenue",d.deliveredRevenue],["COGS",-d.cogs],["Shipping",-d.shipping],["Checkout Fee",-d.checkout],["PG Fee",-d.pg],["Meta Spend + GST",-d.effectiveMarketingCost]
      ].map(([label,v])=><div className="breakdown-row" key={String(label)}><span className="breakdown-label">{label}</span><span className="breakdown-value">{formatCurrency(Number(v))}</span></div>)}</div></div>
      <div className="card breakdown span-4"><div className="card-title">Profit ratios</div><div className="breakdown-list mt-2">
        {[["Profit Margin",formatPercent(d.profitMargin)],["AOV",formatCurrency(d.aov)],["Profit / Delivered Order",formatCurrency(d.profitPerDeliveredOrder)],["Marketing / Delivered Order",formatCurrency(d.marketingCostPerDeliveredOrder)],["Effective Marketing Cost",formatCurrency(d.effectiveMarketingCost)]].map(([label,v])=><div className="breakdown-row" key={String(label)}><span className="breakdown-label">{label}</span><span className="breakdown-value">{v}</span></div>)}
      </div></div>
    </div>
    <div className="mt-3"><ProfitSimulator actual={d} targetProfit={Number(ctx.business?.settings?.target_profit??0)||null}/></div>
  </AppShell>
}