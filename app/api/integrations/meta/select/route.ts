import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ businessId: z.string().uuid(), accountIds: z.array(z.string().min(1)).min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const membership = await requireBusinessAccess(body.businessId, ["client", "admin", "super_admin"]);
    const s = await createClient();
    const { data: integration, error } = await s.from("integrations").select("id,metadata").eq("business_id", body.businessId).eq("provider", "meta").maybeSingle();
    if (error) throw error;
    if (!integration) return NextResponse.json({ error: "Meta is not connected." }, { status: 400 });
    const available = new Set((((integration.metadata as any)?.ad_accounts ?? []) as any[]).map((x: any) => String(x.id)));
    const selected = body.accountIds.filter((id: string) => available.has(id));
    if (!selected.length) return NextResponse.json({ error: "Select at least one connected Meta ad account." }, { status: 400 });
    const metadata = { ...(integration.metadata ?? {}), selected_ad_account_ids: selected };
    const { error: updateError } = await s.from("integrations").update({ metadata }).eq("id", integration.id);
    if (updateError) throw updateError;
    await s.from("integration_accounts").update({ metadata }).eq("integration_id", integration.id);
    await s.from("audit_logs").insert({ business_id: body.businessId, user_id: membership.user.id, action: "integration.meta_accounts.selected", entity_type: "integration", entity_id: integration.id, old_value: integration.metadata ?? null, new_value: metadata });
    return NextResponse.json({ ok: true, selected });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Could not save Meta ad-account selection." }, { status: 400 });
  }
}
