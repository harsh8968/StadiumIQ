"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, MessageSquare, ShoppingBag, User, Zap } from "lucide-react";
import { MatchClock } from "./MatchClock";
import { BRAND } from "@/lib/brand";

const TABS = [
  { href: "/map",       label: "Map",       icon: Map },
  { href: "/concierge", label: "Concierge", icon: MessageSquare },
  { href: "/order",     label: "Order",     icon: ShoppingBag },
  { href: "/profile",   label: "Profile",   icon: User },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/map":       "Venue Map",
  "/concierge": "AI Concierge",
  "/order":     "Order",
  "/analytics": "Analytics",
  "/group":     "Group",
  "/profile":   "Profile",
};

interface Props {
  children: React.ReactNode;
}

export function AppShell({ children }: Props) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? BRAND.name;

  return (
    <div className="flex flex-col h-screen bg-slate-950 md:flex-row">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex flex-col w-56 border-r border-slate-800 bg-slate-900 shrink-0"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
          <Zap className="w-5 h-5 text-sky-500" aria-hidden="true" />
          <span className="font-bold text-white text-sm">{BRAND.name}</span>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1 p-3 flex-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  active
                    ? "bg-sky-600/20 text-sky-400 font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800">
          <MatchClock />
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Mobile top bar */}
        <header
          role="banner"
          className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-500" aria-hidden="true" />
            <h1 className="text-sm font-semibold text-white">{title}</h1>
          </div>
          <MatchClock />
        </header>

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-h-0 overflow-hidden pb-14 md:pb-0 focus:outline-none"
        >
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Mobile primary navigation"
          className="md:hidden fixed bottom-0 inset-x-0 flex border-t border-slate-800 bg-slate-900 z-50"
        >
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset ${
                  active ? "text-sky-400" : "text-slate-500"
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
