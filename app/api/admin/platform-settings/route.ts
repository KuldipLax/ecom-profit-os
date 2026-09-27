import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  rows: z.array(z.object({ key: z.string().min(1), value: z.any() })),
});

export async function POST(req: NextRequest) {
  const { user } = await requireSuperAdmin();

  try {
    const body = schema.parse(await req.json().catch(() => ({})));
    const admin = createAdminClient();

    for (const row of body.rows) {
      const { error } = await admin
        .from("platform_settings")
        .upsert(
          {
            key: row.key,
            value: row.value,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      if (error) throw error;
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "platform.settings.updated",
      entity_type: "platform_settings",
      new_value: body.rows,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Could not save global settings." },
      { status: 400 },
    );
  }
}
