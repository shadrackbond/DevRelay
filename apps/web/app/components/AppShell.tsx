import type { ReactNode } from "react";

const nav = [
  { label: "Command Center", href: "/" },
  { label: "Incidents", href: "/incidents" },
  { label: "Investigations", href: "/investigations" },
  { label: "Agents", href: "/agents" },
  { label: "Integrations", href: "/integrations" },
  { label: "Audit Log", href: "/audit" },
];

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">◆ DevRelay</a>
        <nav>
          {nav.map((item) => (
            <a
              key={item.href}
              className={item.label === active ? "active" : undefined}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
