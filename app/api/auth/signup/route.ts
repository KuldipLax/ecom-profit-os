import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Supabase authentication is not configured on this deployment." },
        { status: 503 },
      );
    }

    const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items) {
          items.forEach(({ name, value, options }) => cookiesToSet.push({ name, value, options }));
        },
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.name },
        emailRedirectTo: new URL("/auth/callback?next=/onboarding", request.url).toString(),
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = NextResponse.json(
      { ok: true, session: Boolean(data.session), needsEmailVerification: !data.session },
      { headers: { "Cache-Control": "no-store" } },
    );
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Account creation failed." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
