import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export async function GET(_req:NextRequest,{params}:{params:Promise<{businessId:string}>}){
  const {memberships}=await requireAdmin();const {businessId}=await params;
  if(!memberships.some((m:any)=>m.role==='super_admin'||m.business_id===businessId))return NextResponse.json({error:'Access denied.'},{status:403});
  const a=createAdminClient();
  const [b,i,s,m]=await Promise.all([
    a.from('businesses').select('*').eq('id',businessId).maybeSingle(),
    a.from('integrations').select('*').eq('business_id',businessId),
    a.from('sync_jobs').select('*').eq('business_id',businessId).order('created_at',{ascending:false}).limit(20),
    a.from('memberships').select('id,user_id,role,status,users(email,name)').eq('business_id',businessId).order('created_at',{ascending:true})
  ]);
  return NextResponse.json({business:b.data,integrations:i.data??[],syncJobs:s.data??[],memberships:m.data??[]});
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{businessId:string}>}){
  const {user,memberships}=await requireAdmin();const {businessId}=await params;
  if(!memberships.some((m:any)=>m.role==='super_admin'||m.business_id===businessId))return NextResponse.json({error:'Access denied.'},{status:403});
  const parsed=z.object({status:z.enum(['active','inactive'])}).safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)return NextResponse.json({error:'Invalid client status.'},{status:400});
  const a=createAdminClient();
  const {data:old}=await a.from('businesses').select('status').eq('id',businessId).maybeSingle();
  const {data,error}=await a.from('businesses').update({status:parsed.data.status}).eq('id',businessId).select('id,status').single();
  if(error)return NextResponse.json({error:'Could not update client status.'},{status:500});
  await a.from('memberships').update({status:parsed.data.status==='active'?'active':'disabled'}).eq('business_id',businessId).eq('role','client');
  await a.from('audit_logs').insert({business_id:businessId,user_id:user.id,action:'admin.client.status.updated',entity_type:'business',entity_id:businessId,old_value:old?.status?{status:old.status}:null,new_value:{status:parsed.data.status}});
  return NextResponse.json(data);
}
