import { subDays } from "date-fns";
export function isoToday(){return new Date().toISOString().slice(0,10)}
export function rangeFromPreset(preset:"7d"|"14d"|"30d"|"month"|"custom",end=isoToday()){const e=new Date(`${end}T00:00:00Z`);if(preset==="month"){return {start:new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth(),1)).toISOString().slice(0,10),end};}const days=preset==="7d"?6:preset==="14d"?13:29;return {start:subDays(e,days).toISOString().slice(0,10),end}}
