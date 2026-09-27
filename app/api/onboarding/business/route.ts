import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: "Your sign-in session has expired. Please sign in again." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("create_business_for_current_user", {
      p_name: body.name,
      p_slug: body.slug,
      p_currency: "INR",
      p_timezone: "Asia/Kolkata",
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That business slug is already in use. Choose another slug." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Business setup failed." }, { status: 400 });
    return NextResponse.json({ ok: true, businessId: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Business setup failed." }, { status: 400 });
  }
}
