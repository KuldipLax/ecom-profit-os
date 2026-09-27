import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, supabase: "not_configured" }, { status: 503 });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("roles").select("name").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, supabase: "reachable" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, supabase: "unreachable", error: error?.message ?? "Database check failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
