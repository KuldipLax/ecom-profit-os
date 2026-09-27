import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { verifyShopifyState } from "@/lib/integrations/shopify/oauth";
import { shopifyGraphQL, verifyShop } from "@/lib/integrations/shopify/client";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function exchangeShopifyCode(shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID ?? "",
      client_secret: env.SHOPIFY_CLIENT_SECRET ?? "",
      code,
    }),
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(json?.errors ? JSON.stringify(json.errors) : "Shopify authorization failed.");
  }
  return String(json.access_token);
}

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookie = request.cookies.get("shopify_oauth_state")?.value ?? "";
  const shop = (request.nextUrl.searchParams.get("shop") ?? "").toLowerCase();
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const businessId = verifyShopifyState(state);

  if (
    cookie !== state ||
    !businessId ||
    !code ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)
  ) {
    return NextResponse.redirect(new URL("/settings?error=Invalid%20Shopify%20authorization%20response.", request.url));
  }

  try {
    const token = await exchangeShopifyCode(shop, code);
    const store = await verifyShop(shop, token);
    const supabase = createAdminClient();

    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .upsert(
        {
          business_id: businessId,
          provider: "shopify",
          status: "connected",
          connected_at: new Date().toISOString(),
          error_message: null,
          metadata: { shop, shop_name: store.shop.name, domain: store.shop.domain },
        },
        { onConflict: "business_id,provider" },
      )
      .select("id")
      .single();

    if (integrationError || !integration) throw integrationError ?? new Error("Could not create Shopify integration.");

    const { error: accountError } = await supabase
      .from("integration_accounts")
      .upsert(
        {
          integration_id: integration.id,
          account_name: store.shop.name || shop,
          external_account_id: shop,
          credentials_encrypted: encryptSecret(token),
          metadata: { shop, domain: store.shop.domain },
          scopes: env.SHOPIFY_SCOPES.split(",").map((item) => item.trim()).filter(Boolean),
        },
        { onConflict: "integration_id,external_account_id" },
      );

    if (accountError) throw accountError;

    const webhookResults = await (async () => {
      const topics = [
        "ORDERS_CREATE",
        "ORDERS_UPDATED",
        "ORDERS_CANCELLED",
        "REFUNDS_CREATE",
        "FULFILLMENTS_UPDATE",
      ];
      const mutation = `mutation Subscribe($topic:WebhookSubscriptionTopic!,$uri:URL!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:{uri:$uri}){userErrors{field message}}}`;
      const results: unknown[] = [];
      for (const topic of topics) {
        try {
          results.push(await shopifyGraphQL(shop, token, mutation, {
            topic,
            uri: `${request.nextUrl.origin}/api/webhooks/shopify`,
          }));
        } catch (error) {
          results.push({ topic, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return results;
    })();

    await supabase.from("audit_logs").insert({
      business_id: businessId,
      user_id: user.id,
      action: "integration.connected",
      entity_type: "integration",
      entity_id: integration.id,
      new_value: { provider: "shopify", shop, webhookResults },
    });

    const response = NextResponse.redirect(new URL("/settings?connected=shopify", request.url));
    response.cookies.set("shopify_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Shopify connection failed.")}`,
        request.url,
      ),
    );
  }
}
