import { rangeFromPreset } from "./date";
import { parseAnalyticsFilters,parseDateRange } from "@/lib/analytics/filters";
export function analyticsQuery(q:Record<string,string|string[]|undefined>){const r=parseDateRange(q as any);const range=r.start&&r.end?{start:r.start,end:r.end}:rangeFromPreset(r.preset);return {range,preset:r.preset,filters:parseAnalyticsFilters(q as any)};}
