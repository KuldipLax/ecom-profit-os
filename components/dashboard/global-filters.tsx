"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { rangeFromPreset } from "@/lib/utils/date";

export function GlobalFilters({ businessId, memberships }: { businessId: string; memberships: any[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  const channel = sp.get("channel") ?? "";
  const product = sp.get("product") ?? "";
  const compare = sp.get("compare") ?? "Previous period";

  function navigate(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    next.set("business", businessId);
    Object.entries(params).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    router.push("/dashboard?" + next.toString());
  }

  const dateText = start && end
    ? `${new Date(start + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(end + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`
    : "Select period";

  return (
    <div className="filters" aria-label="Dashboard filters">
      <button type="button" className="filter" onClick={() => { const range = rangeFromPreset("30d"); navigate({ start: range.start, end: range.end }); }}>
        {dateText} <span className="muted">⌄</span>
      </button>
      <button type="button" className="filter" onClick={() => navigate({ compare: compare === "Previous period" ? "Same period last year" : "Previous period" })}>
        Compare: {compare} <span className="muted">⌄</span>
      </button>
      <select
        className="filter"
        value={channel}
        onChange={(e) => navigate({ channel: e.target.value || undefined })}
        aria-label="Channel"
      >
        <option value="">All channels</option>
        <option value="shopify">Shopify</option>
        <option value="manual">Manual</option>
        <option value="csv">CSV</option>
      </select>
      <select
        className="filter"
        value={product}
        onChange={(e) => navigate({ product: e.target.value || undefined })}
        aria-label="Product"
      >
        <option value="">All products</option>
        <option value="Pile Relief Powder">Pile Relief Powder</option>
        <option value="Men’s Vitality">Men’s Vitality</option>
        <option value="Women’s Daily">Women’s Daily</option>
      </select>
      {memberships.length > 1 && (
        <select
          className="filter"
          value={businessId}
          onChange={(e) => navigate({ business: e.target.value })}
          aria-label="Business"
        >
          {memberships.map((m: any) => (
            <option key={m.business_id} value={m.business_id}>{m.businesses?.name ?? m.business_id}</option>
          ))}
        </select>
      )}
    </div>
  );
}
