import Link from "next/link";
import { BorderlessRelay } from "../components/BorderlessRelay";
import { getWorkspaceId, listStoredIncidents } from "../lib/incident-store";
import { latestInvestigation } from "../lib/history-store";

export const metadata = { title: "Borderless Relay" };

export default async function RelayPage({
  searchParams,
}: {
  searchParams: Promise<{ incident?: string | string[] }>;
}) {
  const ownerId = await getWorkspaceId();
  const incidents = await listStoredIncidents();
  const selected = (await searchParams).incident;
  const selectedId = typeof selected === "string" ? selected : undefined;

  const latest = incidents
    .map((incident) => ({ incident, run: latestInvestigation(ownerId, incident.id) }))
    .filter((item) => item.run);

  const active =
    latest.find((item) => item.incident.id === selectedId) ??
    latest[0];

  return (
    <>
      <header className="pageHeader relayPageHeader">
        <div>
          <p className="eyebrow">BORDERLESS RELAY</p>
          <h1>One verified diagnosis, ready for every audience.</h1>
          <p className="muted">
            Select an investigated incident, then export the same Canonical Reasoning Packet
            as technical English, Kiswahili, plain language, or low-bandwidth text.
          </p>
        </div>
        <Link className="primaryButton" href="/investigations/new">
          + New investigation
        </Link>
      </header>

      <div className="relayWorkspaceLayout">
        <aside className="panel relayIncidentPicker">
          <div className="panelTitle">
            <div>
              <span className="sectionLabel">Investigated incidents</span>
              <h2>Choose a packet</h2>
            </div>
            <span className="statusBadge">{latest.length}</span>
          </div>

          {latest.length === 0 ? (
            <div className="emptyQueue">
              <strong>No reasoning packets yet.</strong>
              <p className="muted">Run an investigation first, then return here to relay its result.</p>
              <Link className="inlineLink" href="/investigations/new">Create an investigation →</Link>
            </div>
          ) : (
            <div className="relayIncidentList">
              {latest.map(({ incident, run }) => (
                <Link
                  key={incident.id}
                  href={`/relay?incident=${incident.id}`}
                  aria-current={active?.incident.id === incident.id ? "page" : undefined}
                >
                  <div>
                    <strong>{incident.title}</strong>
                    <small>{incident.service} · {incident.severity}</small>
                  </div>
                  <span>{Math.round((run?.packet.hypothesis.confidence ?? 0) * 100)}%</span>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <div className="relayWorkspaceMain">
          {active?.run ? (
            <>
              <section className="relayWorkspaceHero">
                <div>
                  <span className="sectionLabel">Incident #{active.incident.id}</span>
                  <h2>{active.incident.title}</h2>
                  <p>{active.run.packet.hypothesis.statement}</p>
                </div>
                <div className="relayWorkspaceStats">
                  <div><span>Confidence</span><strong>{Math.round(active.run.packet.hypothesis.confidence * 100)}%</strong></div>
                  <div><span>Evidence</span><strong>{active.run.packet.hypothesis.evidenceIds.length}</strong></div>
                  <div><span>Missing</span><strong>{active.run.packet.hypothesis.missingEvidence.length}</strong></div>
                  <div><span>Actions</span><strong>{active.run.packet.actions.length}</strong></div>
                </div>
                <Link className="inlineLink" href={`/incidents/${active.incident.id}`}>
                  Open full investigation ↗
                </Link>
              </section>

              <BorderlessRelay packet={active.run.packet} />
            </>
          ) : (
            <section className="panel emptyReasoningState">
              <strong>Relay is waiting for an investigation.</strong>
              <p className="muted">
                Once DevRelay saves a reasoning packet, this workspace can transform it without changing its decision, evidence, confidence, or safety gate.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
