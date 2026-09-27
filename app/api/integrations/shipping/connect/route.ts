import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShiprocketAdapter } from "@/lib/integrations/shipping/shiprocket";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/security/encryption";

const schema = z.object({
  businessId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const membership = await requireBusinessAccess(body.businessId, ["client", "admin", "super_admin"]);
    const adapter = new ShiprocketAdapter(body.email, body.password);
    await adapter.authenticate();

    const supabase = createAdminClient();
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .upsert({
        business_id: body.businessId,
        provider: "shiprocket",
        status: "connected",
        connected_at: new Date().toISOString(),
        last_sync_at: null,
        error_message: null,
        metadata: { api_user_email: body.email, base_url: env.SHIPROCKET_BASE_URL },
      }, { onConflict: "business_id,provider" })
      .select("id")
      .single();

    if (integrationError || !integration) throw integrationError ?? new Error("Could not create shipping integration.");

    await supabase.from("integration_accounts").delete().eq("integration_id", integration.id);

    const { error: accountError } = await supabase.from("integration_accounts").insert({
      integration_id: integration.id,
      account_name: "Shiprocket API User",
      external_account_id: `shiprocket:${body.email.toLowerCase()}`,
      credentials_encrypted: encryptSecret(JSON.stringify({ email: body.email, password: body.password })),
      metadata: { api_user_email: body.email },
    });

    if (accountError) throw accountError;

    await supabase.from("audit_logs").insert({
      business_id: body.businessId,
      user_id: membership.user.id,
      action: "integration.connected",
      entity_type: "integration",
      entity_id: integration.id,
      new_value: { provider: "shiprocket", api_user_email: body.email },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message ?? "Shiprocket connection failed. Check the API-user credentials.",
    }, { status: 400 });
  }
}
