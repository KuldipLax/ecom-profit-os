import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env,requireServerSecret } from "@/lib/env";
export function createAdminClient(){if(!env.SUPABASE_URL)throw new Error("Supabase URL is missing.");return createSupabaseClient(env.SUPABASE_URL,requireServerSecret("SUPABASE_SERVICE_ROLE_KEY"),{auth:{autoRefreshToken:false,persistSession:false}});}
