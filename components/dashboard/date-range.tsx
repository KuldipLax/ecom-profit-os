import Link from "next/link";
import { rangeFromPreset } from "@/lib/utils/date";
export function DateRange({preset}:{preset:"7d"|"14d"|"30d"}){const presets=["7d","14d","30d"] as const;return <div className="flex flex-wrap gap-2">{presets.map(p=>{const r=rangeFromPreset(p);return <Link key={p} href={`?preset=${p}`} className={`rounded-md border px-3 py-1.5 text-[11px] ${p===preset?"border-slate-900 bg-slate-900 text-white":"bg-white text-slate-600"}`}>{p.toUpperCase()} <span className="ml-1 opacity-60">{r.start} → {r.end}</span></Link>})}</div>}
