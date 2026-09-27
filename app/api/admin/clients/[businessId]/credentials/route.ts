import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  password: z.string().min(12).max(128).optional(),
});
function generatePassword() {
  return `Epo-${crypto.randomBytes(9).toString("base64url")}-Aa9!`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { user, memberships } = await requireAdmin();
  const { businessId } = await params;
  if (!memberships.some((m: any) => m.role === "super_admin" || m.business_id === businessId)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const supabase = createAdminClient();
    const { data: membership, error: membershipError } = await supabase.from("memberships").select("user_id").eq("business_id", businessId).eq("role", "client").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.user_id) return NextResponse.json({ error: "No client login is attached to this business." }, { status: 404 });
    const password = body.password ?? generatePassword();
    const updated = await supabase.auth.admin.updateUserById(membership.user_id, { password });
    if (updated.error) throw updated.error;
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user.id, action: "admin.client.credentials.reset",
      entity_type: "user", entity_id: membership.user_id, new_value: { email: updated.data.user?.email ?? null, method: "admin_generated_password" },
    });
    return NextResponse.json({ ok: true, credentials: { email: updated.data.user?.email ?? null, password } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Could not reset client credentials." }, { status: 400 });
  }
}
