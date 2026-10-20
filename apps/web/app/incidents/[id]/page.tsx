import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoredIncident } from "../../lib/incident-store";
import { runRepositoryAgent } from "../../lib/repository-agent";

export const metadata = { title: "Incident investigation" };

function severityClass(severity: string) {
  return severity === "critical" ? "critical" : `severityBadge severity-${severity}`;
}

function scoreClass(score: number) {
  if (score >= 60) return "scoreHigh";
  if (score >= 35) return "scoreMedium";
  return "scoreLow";
}

export default async function DynamicIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incident = await getStoredIncident(id);

  if (!incident) notFound();

  const repositoryResult = await runRepositoryAgent(incident);
  const repositoryReady = repositoryResult.status === "complete";

  const evidencePlan = [
    {
      agent: "Repository Agent",
      detail: repositoryReady
        ? `Inspected ${repositoryResult.inspected.commits} commits and ${repositoryResult.inspected.pullRequests} pull requests.`
        : "Repository inspection failed.",
      status: repositoryReady ? "complete" : "error",
    },
    {
      agent: "CI Agent",
      detail: "Builds, tests, failed jobs, deployment checks",
      status: "awaiting",
    },
    {
      agent: "Log Agent",
      detail: "Runtime errors and correlated request failures",
      status: "awaiting",
    },
    {
      agent: "Database Agent",
      detail: "Connection pressure, latency, health signals",
      status: "awaiting",
    },
  ];

  return (
    <>
      <div className="incidentTopbar">
        <Link className="backLink" href="/incidents">← Incident queue</Link>
        <span className={severityClass(incident.severity)}>{incident.severity}</span>
      </div>

      <section className="incidentHero">
        <div>
          <p className="eyebrow">INCIDENT #{incident.id}</p>
          <h1>{incident.title}</h1>
          <p className="muted">{incident.description}</p>
        </div>
        <div className="stateBadge">
          <strong>{repositoryReady ? "Repository evidence collected" : "Repository check failed"}</strong>
          <span>investigation state</span>
        </div>
      </section>

      <div className="investigationGrid">
        <section className="panel">
          <span className="sectionLabel">Incident intake</span>
          <h2>Investigation context</h2>
          <p className="muted">
            DevRelay is collecting evidence without making a root-cause claim until
            multiple sources corroborate one another.
          </p>

          <dl className="incidentFacts">
            <div><dt>Service</dt><dd>{incident.service}</dd></div>
            <div><dt>Repository</dt><dd>{incident.repository ?? "Not configured"}</dd></div>
            <div><dt>Severity</dt><dd>{incident.severity}</dd></div>
            <div><dt>Created</dt><dd>{new Date(incident.createdAt).toLocaleString()}</dd></div>
          </dl>
        </section>

        <aside className="panel">
          <span className="sectionLabel">Evidence plan</span>
          <div className="timeline">
            {evidencePlan.map((item, index) => (
              <div className="timelineItem" key={item.agent}>
                <div className="timelineIndex">{index + 1}</div>
                <div>
                  <strong>{item.agent}</strong>
                  <p>{item.detail}</p>
                  <span
                    className={
                      item.status === "complete"
                        ? "done"
                        : item.status === "error"
                          ? "errorState"
                          : "waiting"
                    }
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Repository Agent</span>
            <h2>Real GitHub evidence</h2>
          </div>
          {repositoryReady && (
            <Link
              className="inlineLink"
              href={`https://github.com/${repositoryResult.repository}`}
              target="_blank"
              rel="noreferrer"
            >
              Open repository ↗
            </Link>
          )}
        </div>

        {repositoryResult.status === "error" ? (
          <div className="providerError">
            <strong>Repository inspection failed</strong>
            <p>{repositoryResult.error}</p>
          </div>
        ) : (
          <>
            <p className="muted">{repositoryResult.summary}</p>

            {repositoryResult.candidates.length > 0 ? (
              <div className="candidateList">
                {repositoryResult.candidates.map((candidate) => (
                  <article className="candidateCard" key={candidate.id}>
                    <div className="candidateTopline">
                      <span className="statusBadge">{candidate.type}</span>
                      <span className={`candidateScore ${scoreClass(candidate.score)}`}>
                        {candidate.score}/100 correlation
                      </span>
                    </div>

                    <h3>{candidate.title}</h3>

                    <ul>
                      {candidate.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>

                    {candidate.files.length > 0 && (
                      <div className="changedFiles">
                        {candidate.files.slice(0, 6).map((path) => (
                          <code key={path}>{path}</code>
                        ))}
                        {candidate.files.length > 6 && (
                          <span>+{candidate.files.length - 6} more</span>
                        )}
                      </div>
                    )}

                    <div className="candidateFooter">
                      <span>
                        {candidate.occurredAt
                          ? new Date(candidate.occurredAt).toLocaleString()
                          : "Timestamp unavailable"}
                      </span>
                      <Link href={candidate.url} target="_blank" rel="noreferrer">
                        View on GitHub ↗
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyQueue">
                <strong>No recent repository candidates found.</strong>
                <p className="muted">
                  DevRelay will wait for other evidence rather than inventing a code-change cause.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel emptyReasoningState">
        <span className="sectionLabel">Reasoning state</span>
        <h2>No final root-cause claim yet</h2>
        <p>
          Repository evidence alone can identify suspicious changes, but it cannot
          establish causality. DevRelay needs runtime, CI, or infrastructure evidence
          before promoting a repository candidate into a root-cause hypothesis.
        </p>

        <div className="nextEvidence">
          <strong>Current repository evidence</strong>
          <span>
            {repositoryResult.evidence.length} normalized evidence item(s) are ready
            for cross-agent correlation.
          </span>
        </div>

        <Link className="primaryButton" href="/integrations">
          View evidence sources
        </Link>
      </section>
    </>
  );
}
