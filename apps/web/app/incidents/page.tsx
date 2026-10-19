import { AppShell } from "../components/AppShell";

export default function IncidentsPage() {
  return (
    <AppShell active="Incidents">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INCIDENTS</p>
          <h1>Incident queue</h1>
          <p className="muted">Review active and recently investigated production incidents.</p>
        </div>
        <a className="primaryButton" href="/investigations/new">+ New investigation</a>
      </header>

      <section className="panel">
        <div className="tableRow tableHeader">
          <span>ID</span><span>Incident</span><span>Severity</span><span>Status</span><span>Action</span>
        </div>
        <div className="tableRow">
          <code>#1042</code>
          <div><strong>Production checkout failing</strong><p className="muted">checkout-service</p></div>
          <span className="critical">Critical</span>
          <span className="done">Investigation ready</span>
          <a className="inlineLink" href="/incidents/1042">Open →</a>
        </div>
      </section>
    </AppShell>
  );
}
