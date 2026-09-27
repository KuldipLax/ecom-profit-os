import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/encryption";
import { testManualProvider, type ManualProvider } from "@/lib/integrations/manual";

export const runtime = "nodejs";

const providerSchema = z.enum([
  "shopify","meta","shiprocket","delhivery","xpressbees","ecom_express","bluedart","dtdc",
  "razorpay","cashfree","payu","phonepe",
]);

const schema = z.object({
  businessId: z.string().uuid(),
  provider: providerSchema,
  action: z.enum(["test","save"]),
  credentials: z.record(z.string().max(10000), z.string().max(10000)),
});

const shippingProviders = ["shiprocket","delhivery","xpressbees","ecom_express","bluedart","dtdc"];
const checkoutProviders = ["razorpay","cashfree","payu","phonepe"];

function withoutEmpty(values: Record<string,string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
}

function metadataFor(provider: ManualProvider, credentials: Record<string,string>, testMessage: string) {
  const meta: Record<string, unknown> = {
    auth_method: "manual",
    setup_state: "saved",
    provider,
    webhook_configured: Boolean(credentials.webhookSecret?.trim()),
    last_test_message: testMessage,
    last_tested_at: new Date().toISOString(),
  };
  if (provider === "shopify") meta.shop = credentials.shop?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (provider === "meta") meta.ad_account_ids = credentials.adAccountIds?.split(/[,\n\s]+/).map((x) => x.trim()).filter(Boolean) ?? [];
  if (credentials.environment) meta.environment = credentials.environment;
  return meta;
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const membership = await requireBusinessAccess(body.businessId, ["client","admin","super_admin"]);
    const credentials = withoutEmpty(body.credentials as Record<string,string>);
    const provider = body.provider as ManualProvider;

    const result = await testManualProvider(provider, credentials);
    if (body.action === "test") {
      return NextResponse.json({
        ok: result.ok,
        supported: result.supported,
        message: result.message,
        details: result.details ?? null,
      }, { status: result.ok || !result.supported ? 200 : 400 });
    }

    if (result.supported && !result.ok) {
      return NextResponse.json({ error: result.message, saved: false }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (shippingProviders.includes(provider) || checkoutProviders.includes(provider) || provider === "shopify") {
      if (!credentials.webhookSecret) throw new Error("Webhook secret is required for manual connections. Generate one and use the same value in the provider webhook settings.");
    }

    if (shippingProviders.includes(provider)) {
      await supabase
        .from("integrations")
        .update({ status: "disconnected" })
        .eq("business_id", body.businessId)
        .in("provider", shippingProviders)
        .neq("provider", provider);

      if (provider === "delhivery" && !credentials.apiToken) {
        throw new Error("Delhivery API token is required.");
      }
      if (provider !== "shiprocket" && !credentials.apiToken && !credentials.apiKey && !credentials.username && !credentials.email) {
        throw new Error("Add the provider credentials before saving.");
      }
    }

    if (checkoutProviders.includes(provider)) {
      await supabase
        .from("integrations")
        .update({ status: "disconnected" })
        .eq("business_id", body.businessId)
        .in("provider", checkoutProviders)
        .neq("provider", provider);
    }

    const status = result.ok ? "connected" : "not_configured";
    const metadata = metadataFor(provider, credentials, result.message);
    if (provider === "meta") {
      metadata.ad_accounts = (result.details?.adAccounts ?? []) as unknown[];
    }

    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .upsert({
        business_id: body.businessId,
        provider,
        status,
        connected_at: result.ok ? new Date().toISOString() : null,
        last_sync_at: null,
        error_message: result.ok ? null : result.supported ? result.message : null,
        metadata,
      }, { onConflict: "business_id,provider" })
      .select("id")
      .single();

    if (integrationError || !integration) throw integrationError ?? new Error("Could not save integration configuration.");

    await supabase.from("integration_accounts").delete().eq("integration_id", integration.id);

    const externalId =
      provider === "shopify"
        ? credentials.shop?.trim().toLowerCase()
        : provider === "meta"
          ? `manual:${membership.user.id}`
          : provider;

    const accountName =
      provider === "shopify" ? credentials.shop ?? "Shopify manual connection"
      : provider === "meta" ? "Meta manual connection"
      : provider;

    const { error: accountError } = await supabase.from("integration_accounts").insert({
      integration_id: integration.id,
      account_name: accountName,
      external_account_id: externalId,
      credentials_encrypted: encryptSecret(JSON.stringify(credentials)),
      scopes: provider === "shopify" ? (credentials.scopes ?? "").split(",").map((x) => x.trim()).filter(Boolean) : [],
      metadata: provider === "meta"
        ? {
            auth_method: "manual",
            provider,
            webhook_configured: Boolean(credentials.webhookSecret),
            ad_accounts: (result.details?.adAccounts ?? []) as unknown[],
            selected_ad_account_ids: (
              Array.isArray(result.details?.selectedIds)
                ? result.details.selectedIds
                : (Array.isArray(result.details?.adAccounts) ? result.details.adAccounts : []).map((item: any) => String(item.id))
            ) as unknown[],
          }
        : {
            auth_method: "manual",
            provider,
            webhook_configured: Boolean(credentials.webhookSecret),
          },
    });
    if (accountError) throw accountError;

    await supabase.from("audit_logs").insert({
      business_id: body.businessId,
      user_id: membership.user.id,
      action: "integration.manual_configured",
      entity_type: "integration",
      entity_id: integration.id,
      new_value: {
        provider,
        status,
        tested: result.ok,
        setup_state: "saved",
        webhook_configured: Boolean(credentials.webhookSecret),
      },
    });

    return NextResponse.json({
      ok: true,
      status,
      saved: true,
      connected: result.ok,
      provider,
      message: result.ok
        ? "Connection verified and saved."
        : result.supported
          ? `Saved, but the connection test failed: ${result.message}`
          : "Configuration saved securely. A live adapter for this provider is not enabled yet.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Integration configuration failed." }, { status: 400 });
  }
}
