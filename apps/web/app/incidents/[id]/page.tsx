import { notFound } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { getStoredIncident } from "../../lib/incident-store";

const evidencePlan = [
  ["Repository Agent", "Recent commits, pull requests, changed files"],
  ["CI Agent", "Builds, tests, failed jobs, deployment checks"],
  ["Log Agent", "Runtime errors and correlated request failures"],
  ["Database Agent", "Connection pressure, latency, health signals"],
];

function severityClass(severity: string) {
  return severity === "critical" ? "critical" : `severityBadge severity-${severity}`;
}

export default async function DynamicIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incident = await getStoredIncident(id);

  if (!incident) notFound();

  return (
    <AppShell active="Incidents">
      <div className="incidentTopbar">
        <a className="backLink" href="/incidents">← Incident queue</a>
        <span className={severityClass(incident.severity)}>{incident.severity}</span>
      </div>

      <section className="incidentHero">
        <div>
          <p className="eyebrow">INCIDENT #{incident.id}</p>
          <h1>{incident.title}</h1>
          <p className="muted">{incident.description}</p>
        </div>
        <div className="stateBadge">
          <strong>Awaiting evidence</strong>
          <span>investigation state</span>
        </div>
      </section>

      <div className="investigationGrid">
        <section className="panel">
          <span className="sectionLabel">Incident intake</span>
          <h2>Investigation created successfully</h2>
          <p className="muted">
            DevRelay has stored this incident and created an investigation
            workspace. Root-cause confidence remains intentionally unavailable
            until evidence is collected.
          </p>

          <dl className="incidentFacts">
            <div><dt>Service</dt><dd>{incident.service}</dd></div>
            <div><dt>Severity</dt><dd>{incident.severity}</dd></div>
            <div><dt>Status</dt><dd>{incident.status}</dd></div>
            <div><dt>Created</dt><dd>{new Date(incident.createdAt).toLocaleString()}</dd></div>
          </dl>
        </section>

        <aside className="panel">
          <span className="sectionLabel">Evidence plan</span>
          <div className="timeline">
            {evidencePlan.map(([agent, detail], index) => (
              <div className="timelineItem" key={agent}>
                <div className="timelineIndex">{index + 1}</div>
                <div>
                  <strong>{agent}</strong>
                  <p>{detail}</p>
                  <span className="waiting">Awaiting connection</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="panel emptyReasoningState">
        <span className="sectionLabel">Reasoning state</span>
        <h2>No root-cause claim yet</h2>
        <p>
          The current investigation has user-reported symptoms but no verified
          external evidence. DevRelay will not fabricate a diagnosis to fill
          this gap.
        </p>
        <div className="nextEvidence">
          <strong>Next required capability</strong>
          <span>
            Connect the Repository Agent to GitHub so DevRelay can inspect real
            code changes for this incident.
          </span>
        </div>
        <a className="primaryButton" href="/integrations">Review integrations →</a>
      </section>
    </AppShell>
  );
}
