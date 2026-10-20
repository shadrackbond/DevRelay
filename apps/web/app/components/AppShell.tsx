import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "./Navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skipLink" href="#main-content">Skip to content</a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <Link className="brand" href="/" aria-label="DevRelay home">
          <svg viewBox="0 0 32 32" aria-hidden="true" className="brandMark">
            <path d="M5 8h11l-5 8H5zM16 16h11v8H16l5-8M16 8h11" />
          </svg>
          <span translate="no">DevRelay</span>
        </Link>
        <div className="workspaceLabel"><span className="workspaceAvatar">D</span><div>Engineering workspace<small>Incident response</small></div></div>
        <Navigation />
        <div className="sidebarNote">
          <span className="statusDot" aria-hidden="true" />
          <strong>Evidence before action</strong>
          <p>You stay in control of production changes.</p>
        </div>
        <div className="sidebarFooter">DevRelay <span>MVP preview</span></div>
      </aside>
      <div className="workspace">
        <header className="workspaceBar">
          <span>Workspace <span aria-hidden="true">/</span> Incident response</span>
          <span className="readOnlyLabel">Read-first autonomy</span>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
