"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Command center", href: "/", path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  { label: "Incidents", href: "/incidents", path: "m12 3 10 18H2L12 3zm0 6v5m0 3v1" },
  { label: "Investigations", href: "/investigations", path: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" },
  { label: "Relay", href: "/relay", path: "M4 7h10m-4-4 4 4-4 4M20 17H10m4-4-4 4 4 4" },
  { label: "Agents", href: "/agents", path: "M8 8h8v8H8zM12 2v6m0 8v6M2 12h6m8 0h6M5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3" },
  { label: "Integrations", href: "/integrations", path: "M8 2v5m8-5v5M6 7h12v3a6 6 0 0 1-12 0V7zm6 9v6" },
  { label: "Audit log", href: "/audit", path: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" },
  { label: "Evaluation", href: "/evaluation", path: "M4 3v18h17M8 16v-4m5 4V7m5 9v-6" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      {items.map(({ label, href, path }) => {
        const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
