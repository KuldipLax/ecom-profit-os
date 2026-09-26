import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
export async function createClient(){if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)throw new Error("Supabase server client is not configured.");const store=await cookies();return createServerClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{cookies:{getAll(){return store.getAll();},setAll(items){try{items.forEach(({name,value,options})=>store.set(name,value,options));}catch{}}}});}
