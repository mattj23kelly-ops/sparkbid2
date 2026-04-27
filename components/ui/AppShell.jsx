"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

/**
 * AppShell — authenticated layout with a persistent left sidebar on desktop
 * and a compact top bar on mobile. Estimator-first for ECs.
 */

const EC_PRIMARY = [
  { href: "/ec",         label: "Dashboard",   icon: HomeIcon },
  { href: "/estimator",  label: "New Estimate", icon: SparkIcon, emphasis: true },
  { href: "/estimates",  label: "My Estimates", icon: ListIcon },
];

const EC_MARKETPLACE = [
  { href: "/browse",   label: "Browse Projects", icon: GridIcon },
  { href: "/ec/bids",  label: "My Bids",         icon: InboxIcon },
];

const GC_PRIMARY = [
  { href: "/gc",            label: "Dashboard", icon: HomeIcon },
  { href: "/gc/post",       label: "Post Project", icon: PlusIcon, emphasis: true },
  { href: "/gc/projects",   label: "My Projects",  icon: ListIcon },
];

function navFor(role) {
  if (role === "gc") return { primary: GC_PRIMARY, secondary: [] };
  return { primary: EC_PRIMARY, secondary: EC_MARKETPLACE };
}

export default function AppShell({ children, role = "ec", user }) {
  const pathname = usePathname();
  const { primary, secondary } = navFor(role);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.full_name ?? user?.email ?? "?")
    .split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Mobile top bar ── */}
      <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <Logo size="sm" />
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="btn btn-ghost !px-2 !py-1.5"
            aria-label="Menu"
          >
            <BurgerIcon />
          </button>
        </div>
        {mobileOpen && (
          <MobileMenu
            primary={primary}
            secondary={secondary}
            pathname={pathname}
            onClose={() => setMobileOpen(false)}
            user={user}
            initials={initials}
          />
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="md:flex">
        {/* Sidebar */}
        <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-slate-200 bg-white">
          <div className="px-5 py-5 border-b border-slate-200">
            <Logo size="md" />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
            <NavSection items={primary} pathname={pathname} />
            {secondary.length > 0 && (
              <NavSection
                label="Marketplace"
                items={secondary}
                pathname={pathname}
              />
            )}
          </nav>

          <UserBadge user={user} initials={initials} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavSection({ label, items, pathname }) {
  return (
    <div>
      {label && (
        <p className="px-2.5 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : item.emphasis
                    ? "text-brand-700 hover:bg-brand-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${
                  active ? "text-brand-600" : item.emphasis ? "text-brand-500" : "text-slate-400"
                }`} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UserBadge({ user, initials }) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 px-4 py-3 border-t border-slate-200 hover:bg-slate-50 transition-colors"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {user?.full_name ?? user?.email ?? "Account"}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {user?.company_name ?? (user?.role === "gc" ? "General Contractor" : "Electrical Contractor")}
        </p>
      </div>
    </Link>
  );
}

function MobileMenu({ primary, secondary, pathname, onClose, user, initials }) {
  return (
    <div className="border-t border-slate-200 px-3 py-3 bg-white" onClick={onClose}>
      <NavSection items={primary} pathname={pathname} />
      {secondary.length > 0 && (
        <div className="mt-4">
          <NavSection label="Marketplace" items={secondary} pathname={pathname} />
        </div>
      )}
      <Link
        href="/profile"
        className="mt-4 flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {user?.full_name ?? user?.email ?? "Account"}
          </p>
          <p className="text-xs text-slate-500">View profile</p>
        </div>
      </Link>
    </div>
  );
}

/* ── Icons (inline SVG — keeps bundle tiny) ─────────────────── */
function HomeIcon(props)  { return svg(props, "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"); }
function SparkIcon(props) { return svg(props, "M12 2v6M12 16v6M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"); }
function ListIcon(props)  { return svg(props, "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"); }
function GridIcon(props)  { return svg(props, "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"); }
function InboxIcon(props) { return svg(props, "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"); }
function PlusIcon(props)  { return svg(props, "M12 5v14M5 12h14"); }
function BurgerIcon(props){ return svg(props, "M3 6h18M3 12h18M3 18h18"); }

function svg(props, d) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}
