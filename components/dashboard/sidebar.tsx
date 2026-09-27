"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { useEffect, useState } from "react";

const links = [
  ["/dashboard", "Dashboard", "grid"],
  ["/orders", "Orders", "bag"],
  ["/profit", "Profit", "trend"],
  ["/marketing", "Marketing", "bars"],
  ["/products", "Products", "layers"],
  ["/rto", "RTO", "box"],
  ["/shipping", "Shipping", "truck"],
  ["/forecast", "Forecast", "forecast"],
] as const;

const workspace = [
  ["/reports", "Reports", "file"],
  ["/settings", "Settings", "settings"],
] as const;

const icon = (kind: string) => {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7 };
  if (kind === "grid") return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
  if (kind === "bag") return <svg {...common}><path d="M5 7h14l-1 12H6L5 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/></svg>;
  if (kind === "trend") return <svg {...common}><path d="M4 18 10 12l4 3 6-7"/><path d="M17 8h3v3"/></svg>;
  if (kind === "bars") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/></svg>;
  if (kind === "layers") return <svg {...common}><path d="m4 7 8-4 8 4-8 4-8-4ZM4 12l8 4 8-4M4 17l8 4 8-4"/></svg>;
  if (kind === "box") return <svg {...common}><path d="M12 4 20 8.5v7L12 20l-8-4.5v-7L12 4Z"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
  if (kind === "truck") return <svg {...common}><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg>;
  if (kind === "forecast") return <svg {...common}><path d="M4 18V9l6-4 5 4 5-4v13"/><path d="M7 15h3M14 14h3"/></svg>;
  if (kind === "file") return <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>;
  if (kind === "settings") return <svg {...common}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19 13 2-1-1-2-2 .2a7.9 7.9 0 0 0-1.1-1.1l.2-2-2-1-1 1.6a8 8 0 0 0-1.6 0L11.5 6l-2 1 .2 2A7.9 7.9 0 0 0 8.6 10l-2-.2-1 2 2 1a8 8 0 0 0 0 1.6l-2 1 1 2 2-.2a7.9 7.9 0 0 0 1.1 1.1l-.2 2 2 1 1-1.6a8 8 0 0 0 1.6 0l1 1.6 2-1-.2-2a7.9 7.9 0 0 0 1.1-1.1l2 .2 1-2-2-1A8 8 0 0 0 19 13Z"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 4.2 1.6c-.9 1-2 1.2-2 2.4M12 16.8v.2"/></svg>;
};

export function Sidebar({ role: _role }: { role: string }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setMobileOpen((v) => !v);
    window.addEventListener("ecom-toggle-sidebar", toggle);
    return () => window.removeEventListener("ecom-toggle-sidebar", toggle);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("collapsed", collapsed);
  }, [collapsed]);

  const item = (href: string, label: string, kind: string) => (
    <Link href={href} onClick={() => setMobileOpen(false)} className={"nav-item " + (path === href || path.startsWith(href + "/") ? "active" : "")}>
      {icon(kind)}<span>{label}</span>
    </Link>
  );

  return (
    <aside className={"sidebar" + (mobileOpen ? " mobile-open" : "")}>
      <div className="brand">
        <div className="brand-mark">EP</div>
        <div className="brand-name">ECOM PROFIT OS</div>
        <button className="collapse-btn" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} type="button" onClick={() => setCollapsed((v) => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M15 18 9 12l6-6"/></svg>
        </button>
      </div>
      <nav className="nav" aria-label="Primary navigation">
        {links.map(([href, label, kind]) => item(href, label, kind))}
        <div className="nav-section-label">Workspace</div>
        {workspace.map(([href, label, kind]) => item(href, label, kind))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-bottom">{item("/help", "Help", "help")}</div>
      <form action={signOut}>
        <button className="account-row" title="Sign out" type="submit"><span className="avatar">EP</span><span className="account-copy"><span className="account-name">Client workspace</span><span className="account-meta">Store account</span></span></button>
      </form>
    </aside>
  );
}
