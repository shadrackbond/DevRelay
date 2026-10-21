import Link from "next/link";
import { listStoredIncidents, getWorkspaceId } from "../lib/incident-store";
import {
  latestInvestigation,
  readInvestigationHistory,
} from "../lib/history-store";

export const metadata = { title: "Incident queue" };

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function IncidentsPage() {
  const stored = await listStoredIncidents();
  const ownerId = await getWorkspaceId();

  const rows = stored.map((incident) => {
    const latest = latestInvestigation(ownerId, incident.id);
    const history = readInvestigationHistory(ownerId, incident.id);
    const live = latest?.details.kind === "live" ? latest.details : undefined;

    const providerStates = live
      ? [
          live.repositoryResult.status === "complete",
          live.ciResult.status === "complete",
          live.logResult.status === "complete",
          live.databaseResult.status === "complete",
        ]
      : [];

    return {
      incident,
      latest,
      runCount: history.length,
      completedProviders: providerStates.filter(Boolean).length,
    };
  });

  const readyCount = rows.filter(
    ({ latest }) => latest?.packet.hypothesis.confidence && latest.packet.hypothesis.confidence >= 0.55,
  ).length;
  const awaitingCount = rows.filter(({ incident }) => incident.status !== "ready").length;

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Incident queue</h1>
          <p className="muted">
            Review incident state, evidence coverage, confidence, and investigation history.
          </p>
        </div>
        <Link className="primaryButton" href="/investigations/new">
          + New investigation
        </Link>
      </header>

      <div className="incidentSummaryGrid" aria-label="Incident summary">
        <article>
          <span>User incidents</span>
          <strong>{stored.length}</strong>
        </article>
        <article>
          <span>Ready diagnoses</span>
          <strong>{readyCount}</strong>
        </article>
        <article>
          <span>Awaiting evidence</span>
          <strong>{awaitingCount}</strong>
        </article>
        <article>
          <span>Demo scenario</span>
          <strong>1</strong>
        </article>
      </div>

      <section className="panel">
        <table className="incidentTable incidentTableDetailed">
          <caption>Your incidents and the checkout demo</caption>
          <thead>
            <tr>
              <th scope="col">Incident</th>
              <th scope="col">Repository</th>
              <th scope="col">Severity</th>
              <th scope="col">Evidence</th>
              <th scope="col">Confidence</th>
              <th scope="col">Runs</th>
              <th scope="col">Updated</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>#1042</code>
                <strong>Production checkout failing</strong>
                <p className="muted">checkout-service · deterministic demo</p>
              </td>
              <td><span className="statusBadge">Demo fixture</span></td>
              <td data-label="Severity"><span className="critical">Critical</span></td>
              <td data-label="Evidence"><span className="done">4/4 sources</span></td>
              <td data-label="Confidence"><strong>91%</strong></td>
              <td data-label="Runs">Saved history</td>
              <td data-label="Updated">Demo</td>
              <td>
                <Link className="inlineLink" href="/incidents/1042" aria-label="Open incident 1042">
                  Open
                </Link>
              </td>
            </tr>

            {rows.map(({ incident, latest, runCount, completedProviders }) => {
              const confidence = latest?.packet.hypothesis.confidence;
              const diagnosisReady = latest?.packet.hypothesis.statement &&
                latest.packet.hypothesis.confidence >= 0.55;

              return (
                <tr key={incident.id}>
                  <td>
                    <code>#{incident.id}</code>
                    <strong>{incident.title}</strong>
                    <p className="muted">{incident.service}</p>
                  </td>
                  <td data-label="Repository">
                    {incident.repository ? (
                      <code className="incidentRepository">{incident.repository}</code>
                    ) : (
                      <span className="muted">Not configured</span>
                    )}
                  </td>
                  <td data-label="Severity">
                    <span className={
                      incident.severity === "critical"
                        ? "critical"
                        : `severityBadge severity-${incident.severity}`
                    }>
                      {incident.severity}
                    </span>
                  </td>
                  <td data-label="Evidence">
                    {latest ? (
                      <span className={completedProviders >= 3 ? "done" : "waiting"}>
                        {completedProviders}/4 sources
                      </span>
                    ) : (
                      <span className="waiting">Not run</span>
                    )}
                  </td>
                  <td data-label="Confidence">
                    {latest && typeof confidence === "number" ? (
                      <div className="incidentConfidence">
                        <strong>{pct(confidence)}</strong>
                        <small>{diagnosisReady ? "diagnosis" : "not promoted"}</small>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="Runs">{runCount}</td>
                  <td data-label="Updated">
                    <time dateTime={incident.updatedAt}>{formatTime(incident.updatedAt)}</time>
                  </td>
                  <td>
                    <Link
                      className="inlineLink"
                      href={`/incidents/${incident.id}`}
                      aria-label={`Open incident ${incident.title}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {stored.length === 0 && (
          <div className="emptyQueue">
            <strong>Your incident queue is clear.</strong>
            <p className="muted">
              Start an investigation when something needs attention, or explore the checkout demo above.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
