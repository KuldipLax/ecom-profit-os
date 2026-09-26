"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function IntegrationsPanel({ businessId, integrations }: { businessId: string; integrations: any[] }) {
  const [shop, setShop] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const get = (provider: string) => integrations.find((item) => item.provider === provider);

  async function sync(path: string) {
    setBusy(path);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("Sync completed. Refresh the page to see the latest timestamp.");
    } catch (error: any) {
      setMessage(error?.message ?? "Sync failed.");
    } finally {
      setBusy("");
    }
  }

  async function disconnect(provider: string) {
    setBusy(`disconnect:${provider}`);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, provider }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(`${provider} disconnected. Refresh this page.`);
    } catch (error: any) {
      setMessage(error?.message ?? "Disconnect failed.");
    } finally {
      setBusy("");
    }
  }

  async function connectShip() {
    setBusy("ship");
    setMessage("");
    try {
      const response = await fetch("/api/integrations/shipping/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("Shiprocket connected. Refresh this page.");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      setMessage(error?.message ?? "Connection failed.");
    } finally {
      setBusy("");
    }
  }

  async function selectMeta() {
    const integration = get("meta");
    const defaultIds = ((integration?.metadata?.selected_ad_account_ids ?? integration?.metadata?.ad_accounts?.map((item: any) => item.id) ?? []) as string[]).join(",");
    const ids = window.prompt("Enter Meta ad account IDs, comma-separated", defaultIds);
    if (ids === null) return;
    const accountIds = ids.split(",").map((item) => item.trim()).filter(Boolean);
    setBusy("meta-select");
    try {
      const response = await fetch("/api/integrations/meta/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, accountIds }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("Meta ad-account selection saved. Refresh this page.");
    } catch (error: any) {
      setMessage(error?.message ?? "Could not save Meta ad-account selection.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-white p-5">
          <div className="flex justify-between"><div className="text-sm font-semibold">Shopify</div><Badge variant={get("shopify")?.status === "connected" ? "success" : "default"}>{get("shopify")?.status ?? "Not connected"}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">GraphQL Admin API + OAuth + signed webhooks.</p>
          <div className="mt-4"><Label>Store domain</Label><Input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="store.myshopify.com" /></div>
          <a className="mt-3 inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs text-white" href={`/api/integrations/shopify/start?businessId=${businessId}&shop=${encodeURIComponent(shop)}`}>Connect Shopify</a>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => sync("/api/integrations/shopify/sync")} disabled={!!busy}>{busy === "/api/integrations/shopify/sync" ? "Syncing…" : "Sync Now"}</Button>
          {get("shopify")?.error_message && <div className="mt-2 text-[10px] text-rose-600">{get("shopify").error_message}</div>}
          {get("shopify")?.last_sync_at && <div className="mt-2 text-[10px] text-slate-400">Last sync {new Date(get("shopify").last_sync_at).toLocaleString()}</div>}
          <Button variant="ghost" className="mt-2 w-full" onClick={() => disconnect("shopify")} disabled={!!busy}>Disconnect</Button>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <div className="flex justify-between"><div className="text-sm font-semibold">Meta Ads</div><Badge variant={get("meta")?.status === "connected" ? "success" : "default"}>{get("meta")?.status ?? "Not connected"}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">OAuth ad-account discovery + daily ad-level insights.</p>
          <a className="mt-4 inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs text-white" href={`/api/integrations/meta/start?businessId=${businessId}`}>Connect Meta</a>
          <Button variant="secondary" className="mt-2 w-full" onClick={selectMeta} disabled={!!busy || get("meta")?.status !== "connected"}>Select Ad Accounts</Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => sync("/api/integrations/meta/sync")} disabled={!!busy}>{busy === "/api/integrations/meta/sync" ? "Syncing…" : "Sync Now"}</Button>
          {get("meta")?.last_sync_at && <div className="mt-2 text-[10px] text-slate-400">Last sync {new Date(get("meta").last_sync_at).toLocaleString()}</div>}
          <Button variant="ghost" className="mt-2 w-full" onClick={() => disconnect("meta")} disabled={!!busy}>Disconnect</Button>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <div className="flex justify-between"><div className="text-sm font-semibold">Shiprocket</div><Badge variant={get("shiprocket")?.status === "connected" ? "success" : "default"}>{get("shiprocket")?.status ?? "Not connected"}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">Provider adapter normalizes shipment status + charges.</p>
          <div className="mt-4 space-y-3"><div><Label>API-user email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div><div><Label>API-user password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div></div>
          <Button className="mt-3 w-full" onClick={connectShip} disabled={!!busy}>{busy === "ship" ? "Checking…" : "Connect Shiprocket"}</Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => sync("/api/integrations/shipping/sync")} disabled={!!busy}>{busy === "/api/integrations/shipping/sync" ? "Syncing…" : "Sync Now"}</Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => disconnect("shiprocket")} disabled={!!busy}>Disconnect</Button>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <div className="flex justify-between"><div className="text-sm font-semibold">Checkout</div><Badge variant={get("checkout")?.status === "connected" ? "success" : "default"}>{get("checkout")?.status ?? "not_configured"}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">No native provider is fabricated. Use manual entry or secure CSV import until a checkout adapter is configured.</p>
          <a className="mt-4 inline-flex h-9 items-center rounded-md border px-3 text-xs" href="/reports">Open CSV import</a>
        </div>
      </div>
      {message && <div className="rounded-md border bg-white px-4 py-3 text-xs text-slate-600">{message}</div>}
    </div>
  );
}
