import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { z } from "zod";
import crypto from "node:crypto";

const createSchema=z.object({
  name:z.string().trim().min(2).max(140),
  email:z.string().email().transform(v=>v.toLowerCase()),
  clientName:z.string().trim().max(120).optional(),
  password:z.string().min(12).max(128).optional()
});

function generatePassword(){
  return `Epo-${crypto.randomBytes(9).toString('base64url')}-Aa9!`;
}

export async function GET(){
  await requireAdmin();
  const a=createAdminClient();
  const {data,error}=await a.from("businesses").select("id,name,slug,status,currency,timezone,created_at,integrations(provider,status,last_sync_at),memberships(user_id,role,status,users(email,name))").order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:"Could not load clients."},{status:500});
  return NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  const {user}=await requireAdmin();
  const parsed=createSchema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Invalid client details."},{status:400});
  const {name,email,clientName}=parsed.data;
  const password=parsed.data.password??generatePassword();
  const a=createAdminClient();

  const {data:existingProfile}=await a.from('users').select('id,email').eq('email',email).maybeSingle();
  if(existingProfile)return NextResponse.json({error:"A user already exists with this email. Use another client login email."},{status:409});

  const created=await a.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:clientName??name}});
  if(created.error||!created.data.user)return NextResponse.json({error:created.error?.message??"Client login could not be created."},{status:502});
  const userId=created.data.user.id;

  const business=await a.from("businesses").insert({name,slug:slugify(name)}).select("id,name,slug").single();
  if(business.error){await a.auth.admin.deleteUser(userId);return NextResponse.json({error:"Business creation failed; the client login was rolled back."},{status:500});}

  const membership=await a.from("memberships").insert({business_id:business.data.id,user_id:userId,role:"client",status:"active"});
  if(membership.error){await a.from('businesses').delete().eq('id',business.data.id);await a.auth.admin.deleteUser(userId);return NextResponse.json({error:"Client membership creation failed; the account was rolled back."},{status:500});}

  await a.from('integrations').insert([
    {business_id:business.data.id,provider:'shopify',status:'not_configured'},
    {business_id:business.data.id,provider:'meta',status:'not_configured'},
    {business_id:business.data.id,provider:'shiprocket',status:'not_configured'},
    {business_id:business.data.id,provider:'checkout',status:'not_configured'}
  ]);
  await a.from("audit_logs").insert({business_id:business.data.id,user_id:user.id,action:"admin.client.created",entity_type:"business",entity_id:business.data.id,new_value:{name,email,client_user_id:userId,auth_method:'admin_created_password'}});

  return NextResponse.json({ok:true,businessId:business.data.id,credentials:{email,password}});
}
