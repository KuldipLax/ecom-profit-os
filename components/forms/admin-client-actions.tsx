"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed.");
    return payload;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function AdminClientActions({
  businessId,
  status,
  clientEmail,
}: {
  businessId: string;
  status: string;
  clientEmail?: string | null;
}) {
  const [msg, setMsg] = useState("");
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function update(next: string) {
    setLoading(true);
    setMsg("");
    setCredentials(null);
    try {
      await requestJson("/api/admin/clients/" + businessId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setMsg("Client set to " + next + ". Refresh to see state.");
    } catch (e: any) {
      setMsg(e?.message ?? "Could not update client.");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setMsg("");
    setCredentials(null);
    try {
      const payload = await requestJson("/api/admin/clients/" + businessId + "/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({}),
      });
      setMsg("Client password reset. Save the new temporary credentials below.");
      setCredentials(payload.credentials);
    } catch (e: any) {
      setMsg(e?.message ?? "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={loading} onClick={() => update(status === "active" ? "inactive" : "active")}>
        {status === "active" ? "Deactivate client" : "Activate client"}
      </Button>
      <Button size="sm" variant="secondary" disabled={loading} onClick={reset}>
        Reset / generate credentials
      </Button>
      {clientEmail && <span className="text-[10px] text-slate-400 self-center">{clientEmail}</span>}
      {msg && <span className="w-full text-[10px] text-slate-500">{msg}</span>}
      {credentials && (
        <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900">
          <div className="font-semibold">New temporary credentials — shown once</div>
          <div className="mt-1">Email: <b>{credentials.email}</b></div>
          <div>Password: <b className="select-all">{credentials.password}</b></div>
          <div className="mt-1 text-amber-700">Password is not persisted in application tables.</div>
        </div>
      )}
    </div>
  );
}
