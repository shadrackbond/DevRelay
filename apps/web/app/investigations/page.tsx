import Link from "next/link";
import { listStoredIncidents } from "../lib/incident-store";

export const metadata = { title: "Investigations" };

export default async function InvestigationsPage() {
  const stored = await listStoredIncidents();

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Investigation workspace</h1>
          <p className="muted">Track ready analyses and incidents waiting for evidence.</p>
        </div>
        <Link className="primaryButton" href="/investigations/new">+ New investigation</Link>
      </header>

      <div className="cardGrid">
        <article className="panel">
          <span className="done">Ready</span>
          <h2>Incident #1042</h2>
          <p className="muted">
            Checkout failures correlated across repository, CI, logs, and database evidence.
          </p>
          <Link className="inlineLink" href="/incidents/1042">Open investigation</Link>
        </article>

        {stored.map((incident) => (
          <article className="panel" key={incident.id}>
            <span className="statusBadge">{incident.status.replaceAll("-", " ")}</span>
            <h2>{incident.title}</h2>
            <p className="muted">{incident.service} · {incident.severity}</p>
            <Link className="inlineLink" href={`/incidents/${incident.id}`}>Open investigation</Link>
          </article>
        ))}
      </div>
    </>
  );
}
