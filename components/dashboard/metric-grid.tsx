import { KPI } from "./kpi";
export function MetricGrid({items}:{items:{label:string;value:number;kind?:"currency"|"number"|"percent"|"x"}[]}){return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">{items.map(x=><KPI key={x.label} label={x.label} value={x.value} kind={x.kind}/>)}</div>}
