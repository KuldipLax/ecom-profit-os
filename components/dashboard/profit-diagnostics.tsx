import { Card, CardContent } from "@/components/ui/card";

export function ProfitDiagnostics({items}:{items:string[]}) {
  return <Card><CardContent><div className="text-xs font-semibold">Profit Diagnostics</div>{items.length ? <div className="mt-3 space-y-2">{items.map((item)=><div key={item} className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">{item}</div>)}</div> : <div className="mt-3 text-xs text-slate-500">No material period-over-period driver detected for the selected range.</div>}</CardContent></Card>;
}
