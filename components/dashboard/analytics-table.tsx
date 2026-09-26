import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";

type Column<T> = { key: keyof T | string; label: string; type?: "currency" | "percent" | "number" | "text" };
function read(obj:any,key:string){return key.split(".").reduce((a,k)=>a?.[k],obj)}
export function AnalyticsTable<T extends Record<string,any>>({rows,columns,empty="No records for this period.",limit}: {rows:T[];columns:Column<T>[];empty?:string;limit?:number}){
  const shown=limit?rows.slice(0,limit):rows;
  return <div className="overflow-x-auto rounded-lg border bg-white"><table className="data-grid min-w-full text-left text-[11px]"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{columns.map(c=><th key={String(c.key)} className="whitespace-nowrap px-3 py-2 font-semibold">{c.label}</th>)}</tr></thead><tbody>{shown.map((row,i)=><tr key={String(row.id??row.key??row.orderId??i)} className="hover:bg-slate-50/60">{columns.map(c=>{const v=read(row,String(c.key));let out=v??"—";if(c.type==="currency")out=formatCurrency(Number(v));else if(c.type==="percent")out=formatPercent(Number(v));else if(c.type==="number")out=formatNumber(Number(v));else if(c.type==="x")out=`${Number(v).toFixed(2)}x`;return <td key={String(c.key)} className="whitespace-nowrap px-3 py-2 text-slate-700">{out}</td>})}</tr>)}</tbody>{shown.length===0&&<tbody><tr><td colSpan={columns.length} className="px-4 py-10 text-center text-xs text-slate-400">{empty}</td></tr></tbody>}</table></div>
}
