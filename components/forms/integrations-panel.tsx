"use client";

import { useMemo, useState } from "react";
import {
  AtSign,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Unplug,
  Webhook,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type IntegrationRow = {
  provider: string;
  status: string;
  last_sync_at?: string | null;
  error_message?: string | null;
  connected_at?: string | null;
  metadata?: Record<string, any> | null;
};

type Props = {
  businessId: string;
  integrations: IntegrationRow[];
  oauthAvailable?: { shopify: boolean; meta: boolean };
};

type Credentials = Record<string, string>;

const SHIPPING_PROVIDERS = [
  { value: "shiprocket", label: "Shiprocket", liveApi: true, fields: [
    { key: "email", label: "API-user email", type: "email", placeholder: "api-user@example.com", required: true },
    { key: "password", label: "API-user password", type: "password", placeholder: "••••••••", required: true },
  ]},
  { value: "delhivery", label: "Delhivery", fields: [
    { key: "apiToken", label: "API token", type: "password", placeholder: "Paste Delhivery API token", required: true },
    { key: "clientId", label: "Client / account ID", type: "text", placeholder: "Optional if your contract requires it" },
  ]},
  { value: "xpressbees", label: "Xpressbees", fields: [
    { key: "apiToken", label: "API token / key", type: "password", placeholder: "Provider-issued token or key", required: true },
    { key: "username", label: "Username / client code", type: "text", placeholder: "Provider-issued identifier" },
    { key: "password", label: "Password / secret", type: "password", placeholder: "••••••••" },
  ]},
  { value: "ecom_express", label: "Ecom Express", fields: [
    { key: "apiKey", label: "API key", type: "password", placeholder: "Provider-issued API key", required: true },
    { key: "username", label: "Username / account", type: "text", placeholder: "Provider-issued identifier" },
    { key: "password", label: "Password / secret", type: "password", placeholder: "••••••••" },
  ]},
  { value: "bluedart", label: "Blue Dart", fields: [
    { key: "apiKey", label: "API key", type: "password", placeholder: "Provider-issued API key", required: true },
    { key: "username", label: "Username / account", type: "text", placeholder: "Provider-issued identifier" },
    { key: "password", label: "Password / secret", type: "password", placeholder: "••••••••" },
  ]},
  { value: "dtdc", label: "DTDC", fields: [
    { key: "apiKey", label: "API key / token", type: "password", placeholder: "Provider-issued API key", required: true },
    { key: "customerCode", label: "Customer code", type: "text", placeholder: "Provider-issued customer code" },
    { key: "password", label: "Password / secret", type: "password", placeholder: "••••••••" },
  ]},
] as const;

const CHECKOUT_PROVIDERS = [
  { value: "razorpay", label: "Razorpay", liveApi: true, fields: [
    { key: "keyId", label: "Key ID", type: "text", placeholder: "rzp_...", required: true },
    { key: "keySecret", label: "Key secret", type: "password", placeholder: "••••••••", required: true },
  ]},
  { value: "cashfree", label: "Cashfree", fields: [
    { key: "clientId", label: "Client ID", type: "text", placeholder: "Provider-issued client ID", required: true },
    { key: "clientSecret", label: "Client secret", type: "password", placeholder: "••••••••", required: true },
  ]},
  { value: "payu", label: "PayU", fields: [
    { key: "merchantKey", label: "Merchant key", type: "text", placeholder: "Provider-issued key", required: true },
    { key: "salt", label: "Salt", type: "password", placeholder: "••••••••", required: true },
  ]},
  { value: "phonepe", label: "PhonePe", fields: [
    { key: "clientId", label: "Client ID", type: "text", placeholder: "Provider-issued client ID", required: true },
    { key: "clientSecret", label: "Client secret", type: "password", placeholder: "••••••••", required: true },
    { key: "clientVersion", label: "Client version", type: "text", placeholder: "As provided by PhonePe" },
    { key: "saltKey", label: "Salt key", type: "password", placeholder: "••••••••" },
  ]},
] as const;

async function requestJson(url: string, init: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? body.message ?? "Request failed.");
    return body;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function IconBox({ children }: { children: React.ReactNode }) {
  return <div className="integration-logo">{children}</div>;
}

function getWebhookUrl(provider: string, businessId: string, origin: string) {
  if (provider === "shopify") return `${origin}/api/webhooks/shopify`;
  return `${origin}/api/webhooks/${provider === "razorpay" || provider === "cashfree" || provider === "payu" || provider === "phonepe" ? "checkout" : "shipping"}/${provider}/${businessId}`;
}

export function IntegrationsPanel({ businessId, integrations, oauthAvailable = { shopify: false, meta: false } }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [shopifyMode, setShopifyMode] = useState<"automatic" | "manual">("automatic");
  const [metaMode, setMetaMode] = useState<"automatic" | "manual">("automatic");
  const [shop, setShop] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");
  const [shopifyWebhookSecret, setShopifyWebhookSecret] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaAccountIds, setMetaAccountIds] = useState("");
  const [shippingProvider, setShippingProvider] = useState(() => SHIPPING_PROVIDERS.find((provider) => integrations.some((item) => item.provider === provider.value && item.metadata?.setup_state === "saved"))?.value ?? "shiprocket");
  const [shippingCredentials, setShippingCredentials] = useState<Credentials>({});
  const [shippingWebhookSecret, setShippingWebhookSecret] = useState("");
  const [checkoutProvider, setCheckoutProvider] = useState(() => CHECKOUT_PROVIDERS.find((provider) => integrations.some((item) => item.provider === provider.value && item.metadata?.setup_state === "saved"))?.value ?? "razorpay");
  const [checkoutCredentials, setCheckoutCredentials] = useState<Credentials>({});
  const [checkoutWebhookSecret, setCheckoutWebhookSecret] = useState("");
  const [metaSelected, setMetaSelected] = useState<string[]>(
    (integrations.find((x) => x.provider === "meta")?.metadata?.selected_ad_account_ids ?? []).map(String),
  );

  const byProvider = useMemo(() => new Map(integrations.map((item) => [item.provider, item])), [integrations]);
  const shopify = byProvider.get("shopify");
  const meta = byProvider.get("meta");
  const shipping = SHIPPING_PROVIDERS.map((x) => byProvider.get(x.value)).find(Boolean);
  const checkout = CHECKOUT_PROVIDERS.map((x) => byProvider.get(x.value)).find(Boolean);

  const shopifySaved = Boolean(saved.shopify || shopify?.metadata?.setup_state === "saved" || shopify?.status === "connected");
  const metaSaved = Boolean(saved.meta || meta?.metadata?.setup_state === "saved" || meta?.status === "connected");
  const shippingSaved = Boolean(saved.shipping || shipping?.metadata?.setup_state === "saved" || shipping?.status === "connected");
  const checkoutSaved = Boolean(saved.checkout || checkout?.metadata?.setup_state === "saved" || checkout?.status === "connected");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const openCard = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const setCredential = (setter: React.Dispatch<React.SetStateAction<Credentials>>, key: string, value: string) =>
    setter((current) => ({ ...current, [key]: value }));

  const generateSecret = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

  async function testManual(provider: string, credentials: Credentials) {
    setBusy(`test:${provider}`);
    setMessage("");
    try {
      const result = await requestJson("/api/integrations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ businessId, provider, action: "test", credentials }),
      });
      setMessage(result.message ?? "Connection test completed.");
      return Boolean(result.ok);
    } catch (error: any) {
      setMessage(error?.message ?? "Connection test failed.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function saveManual(card: string, provider: string, credentials: Credentials) {
    setBusy(`save:${provider}`);
    setMessage("");
    try {
      const result = await requestJson("/api/integrations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ businessId, provider, action: "save", credentials }),
      });
      setSaved((current) => ({ ...current, [card]: true }));
      setConnected((current) => ({ ...current, [card]: Boolean(result.connected) }));
      setMessage(result.message ?? "Integration configuration saved.");
    } catch (error: any) {
      setMessage(error?.message ?? "Integration configuration failed.");
    } finally {
      setBusy("");
    }
  }

  async function sync(provider: string, url: string, card: string) {
    setBusy(`sync:${card}`);
    setMessage("");
    try {
      await requestJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, provider }),
      });
      setMessage("Sync completed. Reload the page to see the latest sync timestamp.");
    } catch (error: any) {
      setMessage(error?.message ?? "Sync failed.");
    } finally {
      setBusy("");
    }
  }

  async function disconnect(provider: string, card: string) {
    setBusy(`disconnect:${card}`);
    setMessage("");
    try {
      await requestJson("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, provider }),
      });
      setSaved((current) => ({ ...current, [card]: false }));
      setConnected((current) => ({ ...current, [card]: false }));
      setMessage("Integration disconnected.");
    } catch (error: any) {
      setMessage(error?.message ?? "Could not disconnect.");
    } finally {
      setBusy("");
    }
  }

  async function saveMetaSelection() {
    setBusy("meta-select");
    setMessage("");
    try {
      await requestJson("/api/integrations/meta/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, accountIds: metaSelected }),
      });
      setMessage("Meta ad-account selection saved.");
    } catch (error: any) {
      setMessage(error?.message ?? "Could not save Meta ad-account selection.");
    } finally {
      setBusy("");
    }
  }

  const metaAccounts = ((meta?.metadata?.ad_accounts ?? []) as any[]).map((account) => ({
    id: String(account.id),
    name: String(account.name ?? account.id),
    currency: account.currency ? String(account.currency) : "",
  }));

  function cardStatus(card: string, item?: IntegrationRow) {
    if (connected[card] || item?.status === "connected") return { label: "Saved", tone: "saved" };
    if (saved[card] || item?.metadata?.setup_state === "saved") return { label: "Saved", tone: "saved" };
    return { label: item?.status ?? "Not connected", tone: "off" };
  }

  return (
    <div className="settings-stack">
      <div className="card settings-card-wide">
        <div className="settings-card-head">
          <div>
            <h3>Connections</h3>
            <p>Open a card only when you need to configure it. Credentials stay encrypted on the server.</p>
          </div>
        </div>

        <div className="integration-grid">
          <div className="integration-card integration-card-stack">
            <button type="button" className="integration-card-trigger" onClick={() => openCard("shopify")} aria-expanded={!!open.shopify}>
              <IconBox><Store size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Shopify</strong><span>Orders, products, variants, refunds and fulfillment</span></div>
              <span className={`integration-status ${cardStatus("shopify", shopify).tone === "saved" ? "integration-status-saved" : "off"}`}>{cardStatus("shopify", shopify).label}</span>
              <ChevronDown size={15} className={`integration-chevron ${open.shopify ? "open" : ""}`} />
            </button>

            {open.shopify && (
              <div className="integration-detail">
                <div className="integration-tabs">
                  <button type="button" className={shopifyMode === "automatic" ? "integration-tab active" : "integration-tab"} onClick={() => setShopifyMode("automatic")}>Automatic Connect</button>
                  <button type="button" className={shopifyMode === "manual" ? "integration-tab active" : "integration-tab"} onClick={() => setShopifyMode("manual")}>Manual API Setup</button>
                </div>

                {shopifyMode === "automatic" ? (
                  <div className="integration-guide-box">
                    <div className="integration-guide-title"><ShieldCheck size={14} /> Use this when ECOM Profit OS is registered as a Shopify app.</div>
                    <div className="integration-field"><label>Store domain</label><Input value={shop} onChange={(e) => setShop(e.target.value.trim())} placeholder="your-store.myshopify.com" /></div>
                    {!oauthAvailable.shopify && <div className="integration-warning">Automatic Shopify Connect is not enabled on this deployment yet. Platform Shopify Client ID/Secret must be configured by the platform admin. Manual API setup below does not need those deployment secrets.</div>}
                    <div className="integration-actions">
                      <a className={`primary-btn ${!oauthAvailable.shopify || !shop ? "integration-disabled" : ""}`} href={oauthAvailable.shopify && shop ? `/api/integrations/shopify/start?businessId=${businessId}&shop=${encodeURIComponent(shop)}` : "#"} aria-disabled={!oauthAvailable.shopify || !shop} onClick={(e) => { if (!oauthAvailable.shopify || !shop) e.preventDefault(); }}>Connect Shopify <ExternalLink size={12} /></a>
                      <Button variant="ghost" size="sm" onClick={() => setShopifyMode("manual")}>Use manual instead</Button>
                    </div>
                    <div className="integration-help-list">
                      <span>Automatic flow redirects to Shopify for approval.</span>
                      <span>The returned token is stored encrypted for background sync.</span>
                    </div>
                  </div>
                ) : (
                  <div className="integration-guide-box">
                    <div className="integration-guide-title"><KeyRound size={14} /> Manual Shopify Admin API</div>
                    <div className="integration-fields">
                      <div className="integration-field"><label>Store domain</label><Input value={shop} onChange={(e) => setShop(e.target.value.trim())} placeholder="your-store.myshopify.com" /></div>
                      <div className="integration-field"><label>Admin API access token</label><Input type="password" value={shopifyToken} onChange={(e) => setShopifyToken(e.target.value)} placeholder="Paste the Admin API token" /></div>
                    </div>
                    <div className="integration-field"><label>Webhook secret <span className="field-optional">(needed to use the webhook URL)</span></label><div className="integration-secret-row"><Input type="password" value={shopifyWebhookSecret} onChange={(e) => setShopifyWebhookSecret(e.target.value)} placeholder="Paste or generate a webhook secret" /><Button type="button" variant="secondary" size="sm" onClick={() => setShopifyWebhookSecret(generateSecret())}>Generate</Button></div></div>
                    <div className="integration-help-list">
                      <span>Shopify Admin → Apps and sales channels / Develop apps → configure Admin API scopes → install or generate the token → paste it here.</span>
                      <span>Required data scopes are controlled by your app setup; this product needs order, product and fulfillment read access.</span>
                    </div>
                    <div className="integration-webhook">
                      <div><Webhook size={13} /><strong>Webhook</strong><span>POST endpoint for order/refund/fulfillment events</span></div>
                      <code>{getWebhookUrl("shopify", businessId, origin)}</code>
                      {origin && <button type="button" className="icon-copy" onClick={() => navigator.clipboard?.writeText(getWebhookUrl("shopify", businessId, origin))} aria-label="Copy Shopify webhook URL"><Copy size={13} /></button>}
                    </div>
                    <div className="integration-actions">
                      <Button variant="secondary" size="sm" onClick={() => testManual("shopify", { shop, adminApiToken: shopifyToken, webhookSecret: shopifyWebhookSecret })} disabled={!!busy || !shop || !shopifyToken}>
                        <ShieldCheck size={12} /> {busy === "test:shopify" ? "Testing…" : "Test Connection"}
                      </Button>
                      <Button size="sm" className={saved.shopify ? "integration-save-button-saved" : ""} onClick={() => saveManual("shopify", "shopify", { shop, adminApiToken: shopifyToken, webhookSecret: shopifyWebhookSecret })} disabled={!!busy || !shop || !shopifyToken || shopifySaved}>
                        <Check size={12} /> {saved.shopify || shopifySaved ? "Saved" : busy === "save:shopify" ? "Saving…" : "Save & Connect"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="integration-footer">
                  {shopifySaved && <span className="integration-saved-chip"><Check size={12} /> Saved</span>}
                  {shopify?.last_sync_at && <span>Last sync: {new Date(shopify.last_sync_at).toLocaleString()}</span>}
                  <div className="integration-actions">
                    <Button variant="secondary" size="sm" onClick={() => sync("shopify", "/api/integrations/shopify/sync", "shopify")} disabled={!!busy || !shopifySaved}>
                      <RefreshCw size={12} /> {busy === "sync:shopify" ? "Syncing…" : "Sync Now"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect("shopify", "shopify")} disabled={!!busy || !shopifySaved}><Unplug size={12} /> Disconnect</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="integration-card integration-card-stack">
            <button type="button" className="integration-card-trigger" onClick={() => openCard("meta")} aria-expanded={!!open.meta}>
              <IconBox><AtSign size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Meta Ads</strong><span>Ad accounts, campaigns, ad sets, ads and spend</span></div>
              <span className={`integration-status ${cardStatus("meta", meta).tone === "saved" ? "integration-status-saved" : "off"}`}>{cardStatus("meta", meta).label}</span>
              <ChevronDown size={15} className={`integration-chevron ${open.meta ? "open" : ""}`} />
            </button>

            {open.meta && (
              <div className="integration-detail">
                <div className="integration-tabs">
                  <button type="button" className={metaMode === "automatic" ? "integration-tab active" : "integration-tab"} onClick={() => setMetaMode("automatic")}>Automatic Connect</button>
                  <button type="button" className={metaMode === "manual" ? "integration-tab active" : "integration-tab"} onClick={() => setMetaMode("manual")}>Manual API Setup</button>
                </div>

                {metaMode === "automatic" ? (
                  <div className="integration-guide-box">
                    <div className="integration-guide-title"><ShieldCheck size={14} /> OAuth is the normal path for a Meta app used across client ad accounts.</div>
                    {!oauthAvailable.meta && <div className="integration-warning">Automatic Meta Connect is not enabled on this deployment yet. Platform Meta App ID/Secret/API version must be configured by the platform admin.</div>}
                    <div className="integration-actions">
                      <a className={`primary-btn ${metaSaved ? "integration-save-button-saved" : ""} ${!oauthAvailable.meta || metaSaved ? "integration-disabled" : ""}`} href={oauthAvailable.meta && !metaSaved ? `/api/integrations/meta/start?businessId=${businessId}` : "#"} aria-disabled={!oauthAvailable.meta || metaSaved} onClick={(e) => { if (!oauthAvailable.meta || metaSaved) e.preventDefault(); }}>{metaSaved ? <><Check size={12} /> Saved</> : <>Connect Meta <ExternalLink size={12} /></>}</a>
                      <Button variant="ghost" size="sm" onClick={() => setMetaMode("manual")}>Use manual instead</Button>
                    </div>
                    {metaAccounts.length > 0 && (
                      <div className="meta-account-picker">
                        <div className="integration-guide-title">Select ad accounts to sync</div>
                        {metaAccounts.map((account) => (
                          <label className="meta-account-row" key={account.id}>
                            <input type="checkbox" checked={metaSelected.includes(account.id)} onChange={(e) => setMetaSelected((current) => e.target.checked ? [...new Set([...current, account.id])] : current.filter((id) => id !== account.id))} />
                            <span>{account.name}</span><small>{account.id}{account.currency ? ` · ${account.currency}` : ""}</small>
                          </label>
                        ))}
                        <Button size="sm" onClick={saveMetaSelection} disabled={!!busy || !metaSelected.length}>{busy === "meta-select" ? "Saving…" : "Save Account Selection"}</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="integration-guide-box">
                    <div className="integration-guide-title"><KeyRound size={14} /> Manual Meta Marketing API</div>
                    <div className="integration-field"><label>Access token</label><Input type="password" value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder="Paste a token with the required Ads permissions" /></div>
                    <div className="integration-field"><label>Ad account ID(s)</label><textarea className="integration-textarea" value={metaAccountIds} onChange={(e) => setMetaAccountIds(e.target.value)} placeholder="act_123456789, act_987654321" /></div>
                    <div className="integration-help-list">
                      <span>Enter one or more ad account IDs separated by comma, space or newline.</span>
                      <span>Use a token that is actually permitted to read those ad accounts; the test checks access before saving.</span>
                    </div>
                    <div className="integration-actions">
                      <Button variant="secondary" size="sm" onClick={() => testManual("meta", { accessToken: metaToken, adAccountIds: metaAccountIds })} disabled={!!busy || !metaToken}>
                        <ShieldCheck size={12} /> {busy === "test:meta" ? "Testing…" : "Test Connection"}
                      </Button>
                      <Button size="sm" className={saved.meta ? "integration-save-button-saved" : ""} onClick={() => saveManual("meta", "meta", { accessToken: metaToken, adAccountIds: metaAccountIds })} disabled={!!busy || !metaToken || metaSaved}>
                        <Check size={12} /> {saved.meta || metaSaved ? "Saved" : busy === "save:meta" ? "Saving…" : "Save & Connect"}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="integration-footer">
                  {metaSaved && <span className="integration-saved-chip"><Check size={12} /> Saved</span>}
                  {meta?.last_sync_at && <span>Last sync: {new Date(meta.last_sync_at).toLocaleString()}</span>}
                  <div className="integration-actions">
                    <Button variant="secondary" size="sm" onClick={() => sync("meta", "/api/integrations/meta/sync", "meta")} disabled={!!busy || !metaSaved || (metaMode === "manual" && !connected.meta && meta?.status !== "connected")}>
                      <RefreshCw size={12} /> {busy === "sync:meta" ? "Syncing…" : "Sync Now"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => disconnect("meta", "meta")} disabled={!!busy || !metaSaved}><Unplug size={12} /> Disconnect</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="integration-card integration-card-stack">
            <button type="button" className="integration-card-trigger" onClick={() => openCard("shipping")} aria-expanded={!!open.shipping}>
              <IconBox><Truck size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Shipping & logistics</strong><span>Courier, freight, RTO, COD and unbilled charges</span></div>
              <span className={`integration-status ${shippingSaved ? "integration-status-saved" : "off"}`}>{shippingSaved ? "Saved" : shipping?.status ?? "Not connected"}</span>
              <ChevronDown size={15} className={`integration-chevron ${open.shipping ? "open" : ""}`} />
            </button>

            {open.shipping && (
              <div className="integration-detail">
                <div className="integration-field">
                  <label>Shipping provider</label>
                  <select className="integration-select" value={shippingProvider} onChange={(e) => setShippingProvider(e.target.value)}>
                    {SHIPPING_PROVIDERS.map((provider) => <option value={provider.value} key={provider.value}>{provider.label}{provider.liveApi ? "" : " · setup ready"}</option>)}
                  </select>
                </div>
                <div className="integration-provider-note">Credentials are provider-specific. Copy the API token/key and any client/account identifier from the provider's API/Developer section. Do not put credentials in a public note or webhook URL.</div>
                <div className="integration-fields">
                  {(SHIPPING_PROVIDERS.find((x) => x.value === shippingProvider)?.fields ?? []).map((field) => (
                    <div className="integration-field" key={field.key}><label>{field.label}{!field.required && <span className="field-optional"> (optional)</span>}</label><Input type={field.type} value={shippingCredentials[field.key] ?? ""} onChange={(e) => setCredential(setShippingCredentials, field.key, e.target.value)} placeholder={field.placeholder} /></div>
                  ))}
                </div>
                <div className="integration-field"><label>Webhook secret <span className="field-optional">(needed to use the webhook URL)</span></label><div className="integration-secret-row"><Input type="password" value={shippingWebhookSecret} onChange={(e) => setShippingWebhookSecret(e.target.value)} placeholder="Paste or generate the webhook secret" /><Button type="button" variant="secondary" size="sm" onClick={() => setShippingWebhookSecret(generateSecret())}>Generate</Button></div></div>
                <div className="integration-webhook">
                  <div><Webhook size={13} /><strong>Webhook</strong><span>Paste this URL into the provider's webhook / developer panel</span></div>
                  <code>{getWebhookUrl(shippingProvider, businessId, origin)}</code>
                  {origin && <button type="button" className="icon-copy" onClick={() => navigator.clipboard?.writeText(getWebhookUrl(shippingProvider, businessId, origin))} aria-label="Copy shipping webhook URL"><Copy size={13} /></button>}
                </div>
                <div className="integration-help-list">
                  <span>Shiprocket: Settings → API → create API user, copy the API credentials, then configure Settings → API → Webhooks with the URL above.</span>
                  <span>Delhivery: Settings → API Setup exposes the API token; its Developer Portal provides the shipment/tracking API details for your account.</span>
                  <span>For other couriers, the fields are intentionally generic until their account-specific API contract is implemented; saving never falsely marks them as live-synced.</span>
                </div>
                <div className="integration-actions">
                  <Button variant="secondary" size="sm" onClick={() => testManual(shippingProvider, { ...shippingCredentials, webhookSecret: shippingWebhookSecret })} disabled={!!busy || !shippingCredentials.email && !shippingCredentials.apiToken && !shippingCredentials.apiKey && !shippingCredentials.username}>
                    <ShieldCheck size={12} /> {busy === `test:${shippingProvider}` ? "Testing…" : "Test Connection"}
                  </Button>
                  <Button size="sm" className={saved.shipping ? "integration-save-button-saved" : ""} onClick={() => saveManual("shipping", shippingProvider, { ...shippingCredentials, webhookSecret: shippingWebhookSecret })} disabled={!!busy || shippingSaved || (!shippingCredentials.email && !shippingCredentials.apiToken && !shippingCredentials.apiKey && !shippingCredentials.username)}>
                    <Check size={12} /> {saved.shipping || shippingSaved ? "Saved" : busy === `save:${shippingProvider}` ? "Saving…" : "Save & Connect"}
                  </Button>
                </div>
                <div className="integration-footer">
                  {shippingSaved && <span className="integration-saved-chip"><Check size={12} /> Saved</span>}
                  <span>{shipping?.metadata?.provider === "shiprocket" ? "Live API sync enabled for Shiprocket." : "Webhook/CSV setup remains available for providers without a live adapter."}</span>
                  <div className="integration-actions">
                    {shipping?.provider === "shiprocket" && shipping?.status === "connected" && <Button variant="secondary" size="sm" onClick={() => sync("shiprocket", "/api/integrations/shipping/sync", "shipping")} disabled={!!busy}><RefreshCw size={12} /> {busy === "sync:shipping" ? "Syncing…" : "Sync Now"}</Button>}
                    {shipping?.provider && <Button variant="ghost" size="sm" onClick={() => disconnect(shipping.provider, "shipping")} disabled={!!busy}><Unplug size={12} /> Disconnect</Button>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="integration-card integration-card-stack">
            <button type="button" className="integration-card-trigger" onClick={() => openCard("checkout")} aria-expanded={!!open.checkout}>
              <IconBox><CreditCard size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Checkout & payments</strong><span>Payment transactions, fees and webhook events</span></div>
              <span className={`integration-status ${checkoutSaved ? "integration-status-saved" : "off"}`}>{checkoutSaved ? "Saved" : checkout?.status ?? "Not connected"}</span>
              <ChevronDown size={15} className={`integration-chevron ${open.checkout ? "open" : ""}`} />
            </button>

            {open.checkout && (
              <div className="integration-detail">
                <div className="integration-field">
                  <label>Payment / checkout provider</label>
                  <select className="integration-select" value={checkoutProvider} onChange={(e) => setCheckoutProvider(e.target.value)}>
                    {CHECKOUT_PROVIDERS.map((provider) => <option value={provider.value} key={provider.value}>{provider.label}{provider.liveApi ? "" : " · setup ready"}</option>)}
                  </select>
                </div>
                <div className="integration-provider-note">Use the exact API credentials from the payment provider's Developer / API section. Test-mode and production credentials are separate where the provider supports environments.</div>
                <div className="integration-fields">
                  {(CHECKOUT_PROVIDERS.find((x) => x.value === checkoutProvider)?.fields ?? []).map((field) => (
                    <div className="integration-field" key={field.key}><label>{field.label}{!field.required && <span className="field-optional"> (optional)</span>}</label><Input type={field.type} value={checkoutCredentials[field.key] ?? ""} onChange={(e) => setCredential(setCheckoutCredentials, field.key, e.target.value)} placeholder={field.placeholder} /></div>
                  ))}
                </div>
                <div className="integration-field">
                  <label>Environment</label>
                  <select className="integration-select" value={checkoutCredentials.environment ?? "production"} onChange={(e) => setCredential(setCheckoutCredentials, "environment", e.target.value)}>
                    <option value="production">Production</option>
                    <option value="test">Test / Sandbox</option>
                  </select>
                </div>
                <div className="integration-field"><label>Webhook secret <span className="field-optional">(needed to use the webhook URL)</span></label><div className="integration-secret-row"><Input type="password" value={checkoutWebhookSecret} onChange={(e) => setCheckoutWebhookSecret(e.target.value)} placeholder="Paste or generate the webhook secret" /><Button type="button" variant="secondary" size="sm" onClick={() => setCheckoutWebhookSecret(generateSecret())}>Generate</Button></div></div>
                <div className="integration-webhook">
                  <div><Webhook size={13} /><strong>Webhook</strong><span>Paste this URL into the provider's webhook setup</span></div>
                  <code>{getWebhookUrl(checkoutProvider, businessId, origin)}</code>
                  {origin && <button type="button" className="icon-copy" onClick={() => navigator.clipboard?.writeText(getWebhookUrl(checkoutProvider, businessId, origin))} aria-label="Copy checkout webhook URL"><Copy size={13} /></button>}
                </div>
                <div className="integration-help-list">
                  <span>Razorpay: Dashboard → Account & Settings → Webhooks, add the URL and the webhook secret.</span>
                  <span>Razorpay live API sync is implemented in this build; other providers can be securely saved but need their dedicated transaction adapter before Sync Now can be enabled.</span>
                  <span>Manual checkout transactions and CSV import remain available below for any provider until its direct API adapter is connected.</span>
                </div>
                <div className="integration-actions">
                  <Button variant="secondary" size="sm" onClick={() => testManual(checkoutProvider, { ...checkoutCredentials, webhookSecret: checkoutWebhookSecret })} disabled={!!busy || !Object.values(checkoutCredentials).some(Boolean)}>
                    <ShieldCheck size={12} /> {busy === `test:${checkoutProvider}` ? "Testing…" : "Test Connection"}
                  </Button>
                  <Button size="sm" className={saved.checkout ? "integration-save-button-saved" : ""} onClick={() => saveManual("checkout", checkoutProvider, { ...checkoutCredentials, webhookSecret: checkoutWebhookSecret })} disabled={!!busy || checkoutSaved || !Object.values(checkoutCredentials).some(Boolean)}>
                    <Check size={12} /> {saved.checkout || checkoutSaved ? "Saved" : busy === `save:${checkoutProvider` ? "Saving…" : "Save & Connect"}
                  </Button>
                </div>
                <div className="integration-footer">
                  {checkoutSaved && <span className="integration-saved-chip"><Check size={12} /> Saved</span>}
                  <span>{checkout?.provider === "razorpay" && checkout?.status === "connected" ? "Live payment sync enabled for Razorpay." : "Manual transaction / CSV fallback remains available."}</span>
                  <div className="integration-actions">
                    {checkout?.provider === "razorpay" && checkout?.status === "connected" && <Button variant="secondary" size="sm" onClick={() => sync("razorpay", "/api/integrations/checkout/sync", "checkout")} disabled={!!busy}><RefreshCw size={12} /> {busy === "sync:checkout" ? "Syncing…" : "Sync Now"}</Button>}
                    {checkout?.provider && <Button variant="ghost" size="sm" onClick={() => disconnect(checkout.provider, "checkout")} disabled={!!busy}><Unplug size={12} /> Disconnect</Button>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && <div className="notice-card">{message}</div>}
    </div>
  );
}
