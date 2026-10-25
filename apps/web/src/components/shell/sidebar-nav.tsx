"use client";

import { cn } from "@kimma/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/conversations", label: "Conversations" },
  { href: "/reports", label: "Reports" },
  { href: "/signals", label: "Signals" },
  { href: "/people", label: "People" },
  { href: "/templates", label: "Templates" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {nav.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-ink text-paper" : "text-muted hover:bg-black/[0.04] hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
