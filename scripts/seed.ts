import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const emails=(process.env.SEED_ADMIN_EMAILS??process.env.SEED_ADMIN_EMAIL??"info@bb24.in,bigbrand24@gmail.com").split(',').map((x:string)=>x.trim().toLowerCase()).filter(Boolean);
const password=process.env.SEED_ADMIN_PASSWORD??`Epo-${crypto.randomBytes(9).toString('base64url')}-Aa9!`;
const businesses=["GS Ayurvedic","Rudraaye","Vedixam","Grendexherbs"];

for(const email of emails){
  const {data:existing}=await admin.auth.admin.listUsers({page:1,perPage:1000});
  const found=existing.users.find((u:any)=>u.email?.toLowerCase()===email);
  let uid=found?.id;
  if(!uid){const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:"Platform Admin"}});if(error||!created.user)throw error??new Error(`Could not create ${email}`);uid=created.user.id;}
  await admin.from('memberships').select('id').eq('user_id',uid).eq('role','super_admin').limit(1);
  for(const name of businesses){
    const {data:biz,error:be}=await admin.from("businesses").upsert({name,slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')},{onConflict:"slug"}).select("id").single();
    if(be)throw be;
    await admin.from("memberships").upsert({business_id:biz.id,user_id:uid!,role:"super_admin",status:"active"},{onConflict:"business_id,user_id"});
    await admin.from('integrations').upsert([{business_id:biz.id,provider:'shopify',status:'not_configured'},{business_id:biz.id,provider:'meta',status:'not_configured'},{business_id:biz.id,provider:'shiprocket',status:'not_configured'},{business_id:biz.id,provider:'checkout',status:'not_configured'}],{onConflict:'business_id,provider'});
  }
  console.log(`Admin ready: ${email}`);
}
console.log(JSON.stringify({adminEmails:emails,temporaryPassword:password,initialBusinesses:businesses},null,2));
