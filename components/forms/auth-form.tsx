"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function postJson(url: string, body: Record<string, unknown>, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Request failed.");
    return payload as Record<string, unknown>;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function AuthForm({ mode }: { mode: "login" | "admin-login" | "signup" | "forgot" | "reset" }) {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      if (mode === "login" || mode === "admin-login") {
        await postJson("/api/auth/login", { email, password });
        const session = await postJson("/api/auth/session", {}, 10000);
        if (session.authenticated !== true) {
          throw new Error("Login succeeded but the session cookie was not retained. Check the deployment auth configuration.");
        }
        const requestedNext = new URLSearchParams(window.location.search).get("next");
        const next =
          requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
            ? requestedNext
            : mode === "admin-login"
              ? "/admin"
              : "/dashboard";
        window.location.assign(next);
        return;
      }

      if (mode === "signup") {
        const result = await postJson("/api/auth/signup", { email, password, name });
        if (result.session) {
          window.location.assign("/onboarding");
        } else {
          setMsg("Account created. Check your email to verify the account, then sign in.");
        }
        return;
      }

      if (mode === "forgot") {
        await postJson("/api/auth/forgot-password", { email });
        setMsg("If the account exists, a password reset link has been sent.");
        return;
      }

      await postJson("/api/auth/update-password", { password });
      setMsg("Password updated.");
      window.setTimeout(() => window.location.assign("/login"), 700);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "signup"
      ? "Create account"
      : mode === "forgot"
        ? "Reset password"
        : mode === "reset"
          ? "Set new password"
          : mode === "admin-login"
            ? "Admin sign in"
            : "Sign in";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-xl font-bold">ECOM PROFIT OS</div>
        <div className="mt-1 text-[11px] text-slate-400">
          Real Profit. Real Costs. Real-Time E-commerce Intelligence.
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-sm font-semibold">{title}</h1>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          {mode !== "reset" && (
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          {!(["forgot", "reset"] as string[]).includes(mode) && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          {mode === "reset" && (
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          {msg && <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</div>}

          <Button className="w-full" disabled={loading}>
            {loading ? "Working…" : title}
          </Button>
        </form>

        {(mode === "login" || mode === "admin-login") && (
          <div className="mt-4 flex justify-between text-xs">
            <Link href="/forgot-password" className="text-slate-500">
              Forgot password?
            </Link>
            <Link href="/signup" className="font-medium">
              Create account
            </Link>
          </div>
        )}

        {mode === "signup" && (
          <div className="mt-4 text-center text-xs">
            Already registered?{" "}
            <Link href="/login" className="font-medium">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
