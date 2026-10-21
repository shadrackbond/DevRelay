import Link from "next/link";
import { getWorkspaceId, listStoredIncidents } from "../lib/incident-store";
import { readInvestigationHistory } from "../lib/history-store";

export const metadata = { title: "Decision audit trail" };

export default async function AuditPage() {
  const ownerId = await getWorkspaceId();
  const runs = readInvestigationHistory(ownerId);
  const incidents = await listStoredIncidents();
  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Decision audit trail</h1>
          <p className="muted">Saved incident intake, investigation evidence, and proposal decisions for this browser workspace.</p>
        </div>
      </header>
      {runs.length === 0 && incidents.length === 0 && <section className="panel"><h2>No saved history yet</h2><p className="muted">Create an investigation or open the checkout demo to save its first snapshot.</p><Link className="inlineLink" href="/incidents">Open incident queue ↗</Link></section>}
      {incidents.length > 0 && <section className="panel">
        <h2>Incident intake</h2>
        <div className="auditList">
          {incidents.map((incident) => <div key={incident.id}>
            <time dateTime={incident.createdAt}>{new Date(incident.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })} UTC</time>
            <strong>human-intake</strong>
            <span>Incident created · <Link href={`/incidents/${incident.id}`}>{incident.title}</Link></span>
          </div>)}
        </div>
      </section>}
      {runs.map((run) => <section className="panel" key={run.id}>
        <span className="sectionLabel">{run.details.kind === "demo" ? "Checkout demo" : "Investigation"} · #{run.incidentId}</span>
        <h2>{run.packet.incident.title}</h2>
        <p className="muted">Snapshot saved {new Date(run.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })} UTC</p>
        <Link className="inlineLink" href={`/incidents/${run.incidentId}?run=${run.id}`}>Open this saved investigation ↗</Link>
        <div className="auditList">
          {run.packet.audit.map((entry, index) => <div key={index}>
            <time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })} UTC</time>
            <strong>{entry.actor}</strong>
            <span>{entry.action.replaceAll("-", " ")}
              {typeof entry.metadata?.description === "string" && <p>{entry.metadata.description}</p>}
              {typeof entry.metadata?.summary === "string" && <p>{entry.metadata.summary}</p>}
              {typeof entry.metadata?.error === "string" && <p>{entry.metadata.error}</p>}
              {typeof entry.metadata?.actionId === "string" && <p>Action: {entry.metadata.actionId}</p>}
              {entry.evidenceIds && entry.evidenceIds.length > 0 && <p>Evidence: {entry.evidenceIds.join(", ")}</p>}
            </span>
          </div>)}
        </div>
      </section>)}
    </>
  );
}
