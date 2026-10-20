import { AppShell } from "../components/AppShell";
import { listStoredIncidents } from "../lib/incident-store";

function badgeClass(severity: string) {
  return severity === "critical" ? "critical" : `severityBadge severity-${severity}`;
}

export default async function IncidentsPage() {
  const stored = await listStoredIncidents();

  return (
    <AppShell active="Incidents">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INCIDENTS</p>
          <h1>Incident queue</h1>
          <p className="muted">Review active and recently created investigations.</p>
        </div>
        <a className="primaryButton" href="/investigations/new">+ New investigation</a>
      </header>

      <section className="panel">
        <div className="tableRow tableHeader">
          <span>ID</span><span>Incident</span><span>Severity</span><span>Status</span><span>Action</span>
        </div>

        <div className="tableRow">
          <code>#1042</code>
          <div>
            <strong>Production checkout failing</strong>
            <p className="muted">checkout-service</p>
          </div>
          <span className="critical">Critical</span>
          <span className="done">Investigation ready</span>
          <a className="inlineLink" href="/incidents/1042">Open →</a>
        </div>

        {stored.map((incident) => (
          <div className="tableRow" key={incident.id}>
            <code>#{incident.id}</code>
            <div>
              <strong>{incident.title}</strong>
              <p className="muted">{incident.service}</p>
            </div>
            <span className={badgeClass(incident.severity)}>{incident.severity}</span>
            <span className="waiting">{incident.status}</span>
            <a className="inlineLink" href={`/incidents/${incident.id}`}>Open →</a>
          </div>
        ))}

        {stored.length === 0 && (
          <div className="emptyQueue">
            <strong>No user-created incidents yet.</strong>
            <p className="muted">Create one to test the new dynamic investigation flow.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
