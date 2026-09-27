"use client";

import { useState } from "react";
import { Store, Facebook, Truck, CreditCard, RefreshCw, Unplug, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function requestJson(url: string, init: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Request failed.");
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

export function IntegrationsPanel({ businessId, integrations }: { businessId: string; integrations: any[] }) {
  const [shop, setShop] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const get = (provider: string) => integrations.find((item) => item.provider === provider);
  const run = async (key: string, url: string, init: RequestInit) => {
    setBusy(key);
    setMessage("");
    try {
      await requestJson(url, init);
      setMessage("Done. Refresh the page to see the latest connection state.");
    } catch (error: any) {
      setMessage(error?.message ?? "Request failed.");
    } finally {
      setBusy("");
    }
  };

  async function connectShiprocket() {
    setBusy("shiprocket");
    setMessage("");
    try {
      await requestJson("/api/integrations/shipping/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ businessId, email, password }),
      });
      setEmail("");
      setPassword("");
      setMessage("Shiprocket connected. Refresh to confirm the connection.");
    } catch (error: any) {
      setMessage(error?.message ?? "Shiprocket connection failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="settings-stack">
      <div className="card settings-card-wide">
        <div className="settings-card-head">
          <div>
            <h3>Connections</h3>
            <p>Connect the systems that provide order, shipping and marketing data.</p>
          </div>
        </div>

        <div className="integration-grid">
          <div className="integration-card integration-card-stack">
            <div className="integration-card-top">
              <IconBox><Store size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Shopify</strong><span>Orders, products, variants and customers</span></div>
              <span className={"integration-status " + (get("shopify")?.status === "connected" ? "" : "off")}>{get("shopify")?.status ?? "Not connected"}</span>
            </div>
            <div className="integration-field">
              <label>Store domain</label>
              <Input value={shop} onChange={(e) => setShop(e.target.value.trim())} placeholder="your-store.myshopify.com" />
              <div className="form-help">Shopify app client ID/secret stay server-side. Enter only the store domain here.</div>
            </div>
            <div className="integration-actions">
              <a className="primary-btn" href={"/api/integrations/shopify/start?businessId=" + businessId + "&shop=" + encodeURIComponent(shop)} aria-disabled={!shop} onClick={(e) => { if (!shop) e.preventDefault(); }}>Connect Shopify <ExternalLink size={12} /></a>
              <Button variant="secondary" size="sm" onClick={() => run("shopify-sync", "/api/integrations/shopify/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) })} disabled={!!busy || get("shopify")?.status !== "connected"}>
                <RefreshCw size={12} /> {busy === "shopify-sync" ? "Syncing…" : "Sync Now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => run("shopify-disconnect", "/api/integrations/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, provider: "shopify" }) })} disabled={!!busy}>
                <Unplug size={12} /> Disconnect
              </Button>
            </div>
          </div>

          <div className="integration-card integration-card-stack">
            <div className="integration-card-top">
              <IconBox><Facebook size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Meta Ads</strong><span>Account, campaign, ad set, ad and spend data</span></div>
              <span className={"integration-status " + (get("meta")?.status === "connected" ? "" : "off")}>{get("meta")?.status ?? "Not connected"}</span>
            </div>
            <div className="integration-actions integration-actions-bottom">
              <a className="primary-btn" href={"/api/integrations/meta/start?businessId=" + businessId}>Connect Meta <ExternalLink size={12} /></a>
              <Button variant="secondary" size="sm" onClick={() => run("meta-sync", "/api/integrations/meta/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) })} disabled={!!busy || get("meta")?.status !== "connected"}>
                <RefreshCw size={12} /> {busy === "meta-sync" ? "Syncing…" : "Sync Now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => run("meta-disconnect", "/api/integrations/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, provider: "meta" }) })} disabled={!!busy}>
                <Unplug size={12} /> Disconnect
              </Button>
            </div>
          </div>

          <div className="integration-card integration-card-stack">
            <div className="integration-card-top">
              <IconBox><Truck size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Shipping account</strong><span>Courier, freight, RTO and unbilled charges</span></div>
              <span className={"integration-status " + (get("shiprocket")?.status === "connected" ? "" : "off")}>{get("shiprocket")?.status ?? "Not connected"}</span>
            </div>
            <div className="integration-fields">
              <div className="integration-field"><label>API-user email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="api-user@example.com" /></div>
              <div className="integration-field"><label>API-user password</label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            </div>
            <div className="integration-actions">
              <Button size="sm" onClick={connectShiprocket} disabled={!!busy || !email || !password}>{busy === "shiprocket" ? "Checking…" : "Connect Shiprocket"}</Button>
              <Button variant="secondary" size="sm" onClick={() => run("ship-sync", "/api/integrations/shipping/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) })} disabled={!!busy || get("shiprocket")?.status !== "connected"}>
                <RefreshCw size={12} /> {busy === "ship-sync" ? "Syncing…" : "Sync Now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => run("ship-disconnect", "/api/integrations/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, provider: "shiprocket" }) })} disabled={!!busy}>
                <Unplug size={12} /> Disconnect
              </Button>
            </div>
          </div>

          <div className="integration-card integration-card-stack">
            <div className="integration-card-top">
              <IconBox><CreditCard size={22} strokeWidth={1.6} /></IconBox>
              <div className="integration-copy"><strong>Checkout / tracking</strong><span>Manual or CSV payment/checkout data until a supported adapter is configured</span></div>
              <span className="integration-status off">{get("checkout")?.status ?? "Not connected"}</span>
            </div>
            <div className="integration-actions integration-actions-bottom">
              <a className="secondary-btn" href={"/reports?business=" + businessId}>Open CSV import</a>
            </div>
          </div>
        </div>
      </div>
      {message && <div className="notice-card">{message}</div>}
    </div>
  );
}
