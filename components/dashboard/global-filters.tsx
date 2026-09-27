"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { rangeFromPreset } from "@/lib/utils/date";

export function GlobalFilters({ businessId }: { businessId: string; memberships?: any[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  const compare = sp.get("compare") ?? "Previous period";
  const channel = sp.get("channel") ?? "";
  const product = sp.get("product") ?? "";
  const dateText = useMemo(() => {
    if (!start || !end) return "30D";
    const fmt = (v: string) => new Date(v + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    return fmt(start) + " – " + fmt(end);
  }, [start, end]);
  function navigate(patch: Record<string, string | null | undefined>) {
    const next = new URLSearchParams(sp.toString());
    next.set("business", businessId);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    router.push(pathname + "?" + next.toString());
  }
  const preset = (key: "7d" | "14d" | "30d" | "month") => {
    const range = rangeFromPreset(key);
    navigate({ start: range.start, end: range.end });
    setOpen(false);
  };
  return (
    <div className="filters" aria-label="Analytics filters">
      <div className="relative">
        <button type="button" className="filter" onClick={() => setOpen((v) => !v)}>{dateText} <span className="muted">⌄</span></button>
        {open && (
          <div className="popover open" style={{ left: 0, top: 38, width: 220 }}>
            <div className="pop-heading">Date range</div>
            <div className="choice-search">
              <button type="button" className="choice-item" onClick={() => preset("7d")}>Last 7 days</button>
              <button type="button" className="choice-item" onClick={() => preset("14d")}>Last 14 days</button>
              <button type="button" className="choice-item" onClick={() => preset("30d")}>Last 30 days</button>
              <button type="button" className="choice-item" onClick={() => preset("month")}>Month to date</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="filter" onClick={() => navigate({ compare: compare === "Previous period" ? "Previous year" : "Previous period" })}>Compare: {compare} <span className="muted">⌄</span></button>
      <select className="filter" value={channel} onChange={(e) => navigate({ channel: e.target.value || null })} aria-label="Channel">
        <option value="">All channels</option><option value="shopify">Shopify</option><option value="manual">Manual</option><option value="csv">CSV</option>
      </select>
      <select className="filter" value={product} onChange={(e) => navigate({ product: e.target.value || null })} aria-label="Product">
        <option value="">All products</option><option value="Pile Relief Powder">Pile Relief Powder</option><option value="Men’s Vitality">Men’s Vitality</option><option value="Women’s Daily">Women’s Daily</option>
      </select>
    </div>
  );
}
