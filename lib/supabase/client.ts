import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
export function createClient(){if(!env.NEXT_PUBLIC_SUPABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw new Error("Supabase client is not configured.");return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);}
