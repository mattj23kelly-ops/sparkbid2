"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const EC_TABS = [
  { href: "/ec",       icon: "⌂",  label: "Home"     },
  { href: "/browse",   icon: "◎",  label: "Projects" },
  { href: "/ec/bids",  icon: "▤",  label: "My Bids"  },
  { href: "/profile",  icon: "◉",  label: "Profile"  },
];

const GC_TABS = [
  { href: "/gc",            icon: "⌂",  label: "Home"    },
  { href: "/gc/post",       icon: "+",  label: "Post"    },
  { href: "/gc/projects",   icon: "▤",  label: "Projects"},
  { href: "/profile",       icon: "◉",  label: "Profile" },
];

export default function NavBar({ role = "ec" }) {
  const pathname = usePathname();
  const tabs = role === "gc" ? GC_TABS : EC_TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center py-3 relative"
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
              <span className={`text-xl mb-0.5 ${isActive ? "text-amber-500" : "text-slate-400"}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-semibold ${isActive ? "text-amber-500" : "text-slate-400"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
