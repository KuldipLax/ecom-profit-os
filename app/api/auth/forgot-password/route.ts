import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";

const schema = z.object({ email: z.string().trim().email() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Supabase authentication is not configured on this deployment." }, { status: 503 });
    }

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items) {
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: new URL("/auth/callback?next=/reset-password", request.url).toString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Password reset request failed." }, { status: 400 });
  }
}
