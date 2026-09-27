"use client";

import { Bell, Search, Store } from "lucide-react";

export function Topbar({ businessName }: { businessName?: string }) {
  return (
    <header className="topbar">
      <button className="mobile-menu" aria-label="Open navigation" type="button" onClick={() => window.dispatchEvent(new Event("ecom-toggle-sidebar"))}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <div className="search-box">
        <Search size={15} strokeWidth={1.7} />
        <input aria-label="Global search" placeholder="Search orders, products, campaigns" />
        <span className="kbd">⌘ K</span>
      </div>
      <div className="top-spacer" />
      <button className="top-btn store" type="button"><Store size={16} strokeWidth={1.6} /><span>{businessName ?? "Store"}</span><span>⌄</span></button>
      <button className="top-icon-btn" type="button" aria-label="Notifications"><Bell size={16} strokeWidth={1.6} /></button>
      <div className="profile-chip"><span className="avatar">EP</span></div>
    </header>
  );
}
