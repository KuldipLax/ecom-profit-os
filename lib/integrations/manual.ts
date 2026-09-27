import { fetchWithRetry } from "@/lib/integrations/http";
import { verifyShop } from "@/lib/integrations/shopify/client";
import { getAdAccounts } from "@/lib/integrations/meta/client";
import { ShiprocketAdapter } from "@/lib/integrations/shipping/shiprocket";

export type ManualProvider =
  | "shopify"
  | "meta"
  | "shiprocket"
  | "delhivery"
  | "xpressbees"
  | "ecom_express"
  | "bluedart"
  | "dtdc"
  | "razorpay"
  | "cashfree"
  | "payu"
  | "phonepe";

export type ManualTestResult = {
  supported: boolean;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeShop(value: unknown) {
  let shop = clean(value).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (shop.endsWith("/admin")) shop = shop.slice(0, -6);
  return shop;
}

async function testShopify(credentials: Record<string, string>): Promise<ManualTestResult> {
  const shop = normalizeShop(credentials.shop);
  const token = clean(credentials.adminApiToken);
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    return { supported: true, ok: false, message: "Enter a valid .myshopify.com store domain." };
  }
  if (!token) return { supported: true, ok: false, message: "Admin API access token is required." };
  try {
    const store = await verifyShop(shop, token);
    return {
      supported: true,
      ok: true,
      message: "Shopify API connection verified.",
      details: { shop, shopName: store.shop.name, domain: store.shop.domain },
    };
  } catch (error) {
    return { supported: true, ok: false, message: error instanceof Error ? error.message : "Shopify verification failed." };
  }
}

async function testMeta(credentials: Record<string, string>): Promise<ManualTestResult> {
  const token = clean(credentials.accessToken);
  if (!token) return { supported: true, ok: false, message: "Meta access token is required." };
  try {
    const accounts = await getAdAccounts(token);
    const requested = clean(credentials.adAccountIds)
      .split(/[,\n\s]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    const available = (accounts.data ?? []).map((item: any) => String(item.id));
    const selected = requested.length ? requested.filter((id) => available.includes(id) || available.includes(id.replace(/^act_/, "")) || available.includes(`act_${id}`)) : available;
    if (requested.length && !selected.length) {
      return { supported: true, ok: false, message: "None of the entered ad account IDs are accessible with this token." };
    }
    return {
      supported: true,
      ok: true,
      message: "Meta API connection verified.",
      details: { accessibleAccounts: available.length, selectedAccounts: selected.length, selectedIds: selected, adAccounts: accounts.data ?? [] },
    };
  } catch (error) {
    return { supported: true, ok: false, message: error instanceof Error ? error.message : "Meta verification failed." };
  }
}

async function testShiprocket(credentials: Record<string, string>): Promise<ManualTestResult> {
  const email = clean(credentials.email);
  const password = clean(credentials.password);
  if (!email || !password) return { supported: true, ok: false, message: "Shiprocket API-user email and password are required." };
  try {
    const adapter = new ShiprocketAdapter(email, password);
    await adapter.authenticate();
    return { supported: true, ok: true, message: "Shiprocket authentication verified." };
  } catch (error) {
    return { supported: true, ok: false, message: error instanceof Error ? error.message : "Shiprocket authentication failed." };
  }
}

async function testRazorpay(credentials: Record<string, string>): Promise<ManualTestResult> {
  const keyId = clean(credentials.keyId);
  const keySecret = clean(credentials.keySecret);
  if (!keyId || !keySecret) return { supported: true, ok: false, message: "Razorpay Key ID and Key Secret are required." };
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const response = await fetchWithRetry("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error?.description || "Razorpay API credentials were rejected.");
    return { supported: true, ok: true, message: "Razorpay API connection verified.", details: { count: Number(json?.count ?? 0) } };
  } catch (error) {
    return { supported: true, ok: false, message: error instanceof Error ? error.message : "Razorpay verification failed." };
  }
}

export async function testManualProvider(provider: ManualProvider, credentials: Record<string, string>): Promise<ManualTestResult> {
  switch (provider) {
    case "shopify": return testShopify(credentials);
    case "meta": return testMeta(credentials);
    case "shiprocket": return testShiprocket(credentials);
    case "razorpay": return testRazorpay(credentials);
    default:
      return {
        supported: false,
        ok: false,
        message: "Credentials can be saved securely, but a live API adapter for this provider is not enabled yet.",
      };
  }
}
