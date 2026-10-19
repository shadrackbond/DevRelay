import { AppShell } from "../components/AppShell";

export default function InvestigationsPage() {
  return (
    <AppShell active="Investigations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INVESTIGATIONS</p>
          <h1>Investigation workspace</h1>
          <p className="muted">Track active reasoning runs and evidence collection.</p>
        </div>
        <a className="primaryButton" href="/investigations/new">+ New investigation</a>
      </header>

      <div className="grid">
        <article className="panel">
          <span className="sectionLabel">Ready</span>
          <h2>Incident #1042</h2>
          <p className="muted">Checkout failures correlated across repository, CI, logs, and database evidence.</p>
          <a className="inlineLink" href="/incidents/1042">Open investigation →</a>
        </article>
        <article className="panel">
          <span className="sectionLabel">Pipeline</span>
          <h2>4 evidence providers</h2>
          <p className="muted">Repository, CI, runtime logs, and database health all completed.</p>
        </article>
      </div>
    </AppShell>
  );
}
