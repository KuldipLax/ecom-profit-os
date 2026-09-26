"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

const n = (v: string) => Number.isFinite(Number(v)) ? Number(v) : 0;

export function ProfitSimulator({ actual, targetProfit }: { actual: any; targetProfit?: number | null }) {
  const defaults = useMemo(() => ({
    orders: Math.max(1, actual.orders || 1),
    aov: actual.aov || 0,
    deliveryRate: (actual.deliveryRate || 0) * 100,
    cogs: actual.effectiveDelivered ? actual.cogs / actual.effectiveDelivered : 0,
    shipping: actual.shipped ? actual.shipping / actual.shipped : 0,
    checkoutRate: actual.grossSale ? actual.checkout / actual.grossSale * 100 : 2,
    pgRate: actual.deliveredRevenue ? actual.pg / actual.deliveredRevenue * 100 : 2,
    metaSpend: actual.metaSpend || 0,
    metaGstRate: actual.metaSpend ? actual.metaGst / actual.metaSpend * 100 : 18,
  }), [actual]);

  const [orders, setOrders] = useState(String(defaults.orders));
  const [aov, setAov] = useState(String(defaults.aov));
  const [deliveryRate, setDeliveryRate] = useState(String(defaults.deliveryRate));
  const [cogs, setCogs] = useState(String(defaults.cogs));
  const [shipping, setShipping] = useState(String(defaults.shipping));
  const [checkoutRate, setCheckoutRate] = useState(String(defaults.checkoutRate));
  const [pgRate, setPgRate] = useState(String(defaults.pgRate));
  const [metaSpend, setMetaSpend] = useState(String(defaults.metaSpend));
  const [metaGstRate, setMetaGstRate] = useState(String(defaults.metaGstRate));

  const sim = useMemo(() => {
    const o = Math.max(0, n(orders));
    const avg = Math.max(0, n(aov));
    const dr = Math.max(0, Math.min(100, n(deliveryRate))) / 100;
    const unitCogs = Math.max(0, n(cogs));
    const ship = Math.max(0, n(shipping));
    const checkout = Math.max(0, n(checkoutRate)) / 100;
    const pg = Math.max(0, n(pgRate)) / 100;
    const rawMeta = Math.max(0, n(metaSpend));
    const gstRate = Math.max(0, n(metaGstRate)) / 100;
    const gross = o * avg;
    const deliveredOrders = o * dr;
    const deliveredRevenue = gross * dr;
    const cogsValue = deliveredOrders * unitCogs;
    const shippingValue = o * ship;
    const checkoutValue = gross * checkout;
    const pgValue = deliveredRevenue * pg;
    const metaGst = rawMeta * gstRate;
    const effectiveMarketing = rawMeta + metaGst;
    const profit = deliveredRevenue - cogsValue - shippingValue - checkoutValue - pgValue - effectiveMarketing;
    const roas = effectiveMarketing ? deliveredRevenue / effectiveMarketing : 0;
    return { orders: o, gross, deliveredOrders, deliveredRevenue, cogsValue, shippingValue, checkoutValue, pgValue, rawMeta, metaGst, effectiveMarketing, profit, margin: deliveredRevenue ? profit / deliveredRevenue : 0, roas, dr, avg, unitCogs, ship, checkout, pg };
  }, [orders, aov, deliveryRate, cogs, shipping, checkoutRate, pgRate, metaSpend, metaGstRate]);

  const target = useMemo(() => {
    const t = Math.max(0, targetProfit || 0);
    const marginBeforeMarketing = 1 - (sim.unitCogs / Math.max(sim.avg, 1)) - sim.pg - (sim.checkout / Math.max(sim.dr, 0.000001));
    const requiredDeliveredRevenue = marginBeforeMarketing > 0 ? (t + sim.shippingValue + sim.effectiveMarketing) / marginBeforeMarketing : 0;
    const contributionPerOrder = sim.dr * sim.avg - sim.dr * sim.unitCogs - sim.ship - sim.avg * sim.checkout - sim.avg * sim.dr * sim.pg;
    const requiredOrders = contributionPerOrder > 0 ? Math.ceil((t + sim.effectiveMarketing) / contributionPerOrder) : 0;
    const denominatorAov = sim.orders * (sim.dr * (1 - sim.pg) - sim.checkout);
    const requiredAov = denominatorAov > 0 ? (t + sim.effectiveMarketing + sim.orders * (sim.ship + sim.dr * sim.unitCogs)) / denominatorAov : 0;
    const denominatorDelivery = sim.orders * (sim.avg * (1 - sim.pg) - sim.unitCogs);
    const requiredDeliveryRate = denominatorDelivery > 0 ? (t + sim.effectiveMarketing + sim.orders * sim.avg * sim.checkout + sim.orders * sim.ship) / denominatorDelivery : 0;
    const maxRawMetaForTarget = sim.deliveredRevenue - sim.cogsValue - sim.shippingValue - sim.checkoutValue - sim.pgValue - t;
    const requiredRawMeta = Math.max(0, maxRawMetaForTarget / (1 + Math.max(0, n(metaGstRate)) / 100));
    const requiredRoas = requiredRawMeta > 0 ? sim.deliveredRevenue / requiredRawMeta : 0;
    return { requiredDeliveredRevenue, requiredOrders, requiredAov, requiredDeliveryRate, requiredRoas };
  }, [targetProfit, sim, metaGstRate]);

  const reset = () => {
    setOrders(String(defaults.orders)); setAov(String(defaults.aov)); setDeliveryRate(String(defaults.deliveryRate)); setCogs(String(defaults.cogs)); setShipping(String(defaults.shipping)); setCheckoutRate(String(defaults.checkoutRate)); setPgRate(String(defaults.pgRate)); setMetaSpend(String(defaults.metaSpend)); setMetaGstRate(String(defaults.metaGstRate));
  };

  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="rounded-lg border bg-white p-5">
      <div className="text-sm font-semibold">Scenario simulator</div>
      <div className="mt-1 text-xs text-slate-500">Simulation only — does not alter actual P&L or source data.</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Orders" value={orders} setValue={setOrders}/>
        <Field label="AOV" value={aov} setValue={setAov}/>
        <Field label="Delivery Rate %" value={deliveryRate} setValue={setDeliveryRate}/>
        <Field label="COGS / delivered unit" value={cogs} setValue={setCogs}/>
        <Field label="Shipping / order" value={shipping} setValue={setShipping}/>
        <Field label="Checkout Fee %" value={checkoutRate} setValue={setCheckoutRate}/>
        <Field label="Prepaid PG Fee %" value={pgRate} setValue={setPgRate}/>
        <Field label="Meta Spend" value={metaSpend} setValue={setMetaSpend}/>
        <Field label="Meta GST %" value={metaGstRate} setValue={setMetaGstRate}/>
      </div>
      <div className="mt-4 flex gap-2"><Button type="button" variant="secondary" onClick={reset}>Reset to actual</Button></div>
    </section>
    <section className="rounded-lg border bg-white p-5">
      <div className="text-sm font-semibold">Scenario output</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[['Projected Revenue',sim.gross],['Estimated Delivered Revenue',sim.deliveredRevenue],['COGS',sim.cogsValue],['Shipping',sim.shippingValue],['Checkout Fee',sim.checkoutValue],['PG Fee',sim.pgValue],['Meta Spend',sim.rawMeta],['Meta GST',sim.metaGst],['Effective Marketing Cost',sim.effectiveMarketing],['Projected Profit',sim.profit]].map(([label,value]) => <div key={String(label)} className="rounded-md border p-3"><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-sm font-semibold">{formatCurrency(Number(value))}</div></div>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="flex justify-between"><span>Projected Margin</span><b>{formatPercent(sim.margin)}</b></div><div className="flex justify-between"><span>Scenario ROAS</span><b>{sim.roas.toFixed(2)}x</b></div></div>
      {targetProfit && targetProfit > 0 && <div className="mt-4 rounded-md border bg-slate-50 p-3 text-xs"><div className="font-semibold">Target Profit Simulator</div><div className="mt-1">Configured target: <b>{formatCurrency(targetProfit)}</b></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><span>Required Delivered Revenue <b>{target.requiredDeliveredRevenue ? formatCurrency(target.requiredDeliveredRevenue) : "—"}</b></span><span>Required Orders <b>{target.requiredOrders || "—"}</b></span><span>Required AOV <b>{target.requiredAov ? formatCurrency(target.requiredAov) : "—"}</b></span><span>Required Delivery Rate <b>{target.requiredDeliveryRate ? formatPercent(target.requiredDeliveryRate) : "—"}</b></span><span>Required ROAS <b>{target.requiredRoas ? target.requiredRoas.toFixed(2) + "x" : "—"}</b></span></div></div>}
    </section>
  </div>;
}

function Field({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  return <div><Label>{label}</Label><Input type="number" step="0.000001" min="0" value={value} onChange={(e) => setValue(e.target.value)}/></div>;
}
