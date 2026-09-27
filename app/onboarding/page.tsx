"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function createBusiness(name: string, slug: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/onboarding/business", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name, slug: slug || slugify(name) }),
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Business setup failed.");
    return payload;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Business setup timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export default function Page() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await createBusiness(name, slug || slugify(name));
      r.push("/dashboard");
    } catch (error: any) {
      setErr(error?.message ?? "Business setup failed. Check the name and slug.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f8fa] p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Create your business</div>
        <p className="mt-1 text-xs text-slate-500">
          Every order, cost and integration belongs to exactly one tenant.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <Label>Business name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, "-"))}
              required
            />
          </div>
          {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <Button className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create business"}
          </Button>
        </form>
      </div>
    </main>
  );
}
