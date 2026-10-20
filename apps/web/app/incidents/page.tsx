import Link from "next/link";
import { listStoredIncidents } from "../lib/incident-store";

export const metadata = { title: "Incident queue" };

export default async function IncidentsPage() {
  const stored = await listStoredIncidents();

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Incident queue</h1>
          <p className="muted">Review incidents, follow the evidence, and decide what happens next.</p>
        </div>
        <Link className="primaryButton" href="/investigations/new">+ New investigation</Link>
      </header>

      <section className="panel">
        <table className="incidentTable">
          <caption>Your incidents and the checkout demo</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Incident</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
          <tbody>
            <tr>
              <td><code>#1042</code></td>
              <td><strong>Production checkout failing</strong><p className="muted">checkout-service · Demo</p></td>
              <td data-label="Severity"><span className="critical">Critical</span></td>
              <td data-label="Status"><span className="done">Investigation ready</span></td>
              <td><Link className="inlineLink" href="/incidents/1042" aria-label="Open incident 1042">Open investigation</Link></td>
            </tr>
            {stored.map((incident) => (
              <tr key={incident.id}>
                <td><code>#{incident.id}</code></td>
                <td><strong>{incident.title}</strong><p className="muted">{incident.service}</p></td>
                <td data-label="Severity"><span className={incident.severity === "critical" ? "critical" : `severityBadge severity-${incident.severity}`}>{incident.severity}</span></td>
                <td data-label="Status"><span className="statusBadge">{incident.status.replaceAll("-", " ")}</span></td>
                <td><Link className="inlineLink" href={`/incidents/${incident.id}`} aria-label={`Open incident ${incident.title}`}>Open investigation</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {stored.length === 0 && (
          <div className="emptyQueue">
            <strong>Your incident queue is clear.</strong>
            <p className="muted">Start an investigation when something needs attention, or explore the checkout demo above.</p>
          </div>
        )}
      </section>
    </>
  );
}
