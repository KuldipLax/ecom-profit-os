import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBusinessPeriodProfit } from "@/lib/profit-engine/server";
import { subDays, endOfMonth, startOfMonth, startOfWeek, endOfWeek } from "date-fns";

export async function persistDailyAggregates(businessId:string, endDate=new Date()){
  const s=createAdminClient();

  const rows:any[]=[];
  for(let i=0;i<30;i++){
    const day=subDays(endDate,29-i), d=day.toISOString().slice(0,10);
    const p=await calculateBusinessPeriodProfit(businessId,d,d,s);
    rows.push({business_id:businessId,metric_date:d,metrics:p.result,calculation_version:p.calculationVersion});
  }
  if(rows.length){const {error}=await s.from('daily_metrics').upsert(rows,{onConflict:'business_id,metric_date'});if(error)throw error;}
  const monthStart=startOfMonth(endDate).toISOString().slice(0,10), monthEnd=endOfMonth(endDate).toISOString().slice(0,10);
  const mp=await calculateBusinessPeriodProfit(businessId,monthStart,monthEnd,s);
  const {error:me}=await s.from('monthly_metrics').upsert({business_id:businessId,metric_month:monthStart,metrics:mp.result,calculation_version:mp.calculationVersion},{onConflict:'business_id,metric_month'});if(me)throw me;
  const ws=startOfWeek(endDate,{weekStartsOn:1}).toISOString().slice(0,10), we=endOfWeek(endDate,{weekStartsOn:1}).toISOString().slice(0,10);
  const wp=await calculateBusinessPeriodProfit(businessId,ws,we,s);
  const {error:weErr}=await s.from('weekly_metrics').upsert({business_id:businessId,metric_week:ws,metrics:wp.result,calculation_version:wp.calculationVersion},{onConflict:'business_id,metric_week'});if(weErr)throw weErr;
  return {dailyRows:rows.length,weekly:ws,monthly:monthStart};
}
