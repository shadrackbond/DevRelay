import { AppShell } from "../components/AppShell";
import { listStoredIncidents } from "../lib/incident-store";

export default async function InvestigationsPage() {
  const stored = await listStoredIncidents();

  return (
    <AppShell active="Investigations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INVESTIGATIONS</p>
          <h1>Investigation workspace</h1>
          <p className="muted">Track ready analyses and incidents waiting for evidence.</p>
        </div>
        <a className="primaryButton" href="/investigations/new">+ New investigation</a>
      </header>

      <div className="cardGrid">
        <article className="panel">
          <span className="done">Ready</span>
          <h2>Incident #1042</h2>
          <p className="muted">
            Checkout failures correlated across repository, CI, logs, and database evidence.
          </p>
          <a className="inlineLink" href="/incidents/1042">Open investigation →</a>
        </article>

        {stored.map((incident) => (
          <article className="panel" key={incident.id}>
            <span className="waiting">Awaiting evidence</span>
            <h2>{incident.title}</h2>
            <p className="muted">{incident.service} · {incident.severity}</p>
            <a className="inlineLink" href={`/incidents/${incident.id}`}>Open investigation →</a>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
