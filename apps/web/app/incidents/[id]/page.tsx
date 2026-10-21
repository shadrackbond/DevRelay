import Link from "next/link";
import { notFound } from "next/navigation";
import { SIMULATED_CHECKOUT_SOURCE } from "@devrelay/integrations";
import { InvestigationReview } from "../../components/InvestigationReview";
import { getStoredIncident, getWorkspaceId } from "../../lib/incident-store";
import { readInvestigation, readInvestigationHistory } from "../../lib/history-store";
import { investigate } from "../../lib/investigation-runner";

export const metadata = { title: "Incident investigation" };

function severityClass(severity: string) {
  return severity === "critical" ? "critical" : `severityBadge severity-${severity}`;
}

function scoreClass(score: number) {
  if (score >= 60) return "scoreHigh";
  if (score >= 35) return "scoreMedium";
  return "scoreLow";
}

function signalClass(signal: string) {
  if (signal === "supports") return "signalSupports";
  if (signal === "contradicts") return "signalContradicts";
  return "signalNeutral";
}

export default async function DynamicIncidentPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string | string[] }>;
}) {
  const { id } = await params;
  const incident = await getStoredIncident(id);

  if (!incident) notFound();

  const ownerId = await getWorkspaceId();
  const selected = (await searchParams).run;
  if (selected !== undefined && typeof selected !== "string") notFound();
  const run = selected ? readInvestigation(ownerId, selected) : await investigate(ownerId, id);
  if (!run || run.incidentId !== id || run.details.kind !== "live") notFound();
  const { repositoryResult, ciResult, logResult, databaseResult } = run.details;
  const reasoningResult = { ...run.details.reasoningResult, packet: run.packet };
  const history = readInvestigationHistory(ownerId, id);

  const repositoryReady = repositoryResult.status === "complete";
  const ciReady = ciResult.status === "complete";
  const logReady = logResult.status === "complete";
  const databaseReady = databaseResult.status === "complete";
  const completedAgents = [repositoryReady, ciReady, logReady, databaseReady].filter(Boolean).length;

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
      detail: ciReady
        ? `Inspected ${ciResult.inspectedRuns} GitHub Actions workflow runs and correlated them to repository candidates.`
        : "GitHub Actions inspection failed.",
      status: ciReady ? "complete" : "error",
    },
    {
      agent: "Log Agent",
      detail:
        logResult.status === "complete"
          ? `Inspected ${logResult.entriesInspected} runtime log entries and correlated signatures to repository candidates.`
          : logResult.status === "unconfigured"
            ? "Runtime log provider is not configured."
            : "Runtime log inspection failed.",
      status:
        logResult.status === "complete"
          ? "complete"
          : logResult.status === "unconfigured"
            ? "awaiting"
            : "error",
    },
    {
      agent: "Database Agent",
      detail:
        databaseResult.status === "complete"
          ? `Captured connection, lock, query, and wait telemetry from ${databaseResult.snapshot?.provider ?? "database"}.`
          : databaseResult.status === "unconfigured"
            ? "Database telemetry provider is not configured."
            : "Database telemetry inspection failed.",
      status:
        databaseResult.status === "complete"
          ? "complete"
          : databaseResult.status === "unconfigured"
            ? "awaiting"
            : "error",
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
          <strong>{completedAgents}/4 evidence agents complete</strong>
          <span>investigation state</span>
        </div>
      </section>

      {[logResult.source, databaseResult.source].includes(SIMULATED_CHECKOUT_SOURCE) && (
        <div className="callout warn" role="note">
          <strong>Simulated evidence</strong>
          <p>Sources marked simulated use checkout demo fixtures. Their signals and confidence describe the demo scenario and do not verify production health.</p>
        </div>
      )}

      <nav className="investigationNav" aria-label="Investigation sections">
        <a href="#diagnosis">Diagnosis</a><a href="#evidence">Evidence</a>
        <a href="#history">History</a><a href="#response">Response</a><a href="#relay">Borderless Relay</a>
      </nav>

      <section className="panel reasoningPanel" id="diagnosis">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Reasoning Agent</span>
            <h2>
              {reasoningResult.status === "complete"
                ? "Leading root-cause hypothesis"
                : "Evidence is not sufficient yet"}
            </h2>
          </div>
          <span className={`reasoningStatus ${reasoningResult.status === "complete" ? "done" : "waiting"}`}>
            {Math.round(reasoningResult.packet.hypothesis.confidence * 100)}% confidence
          </span>
        </div>

        <p className="reasoningStatement">
          {reasoningResult.packet.hypothesis.statement}
        </p>
        <p className="muted">{reasoningResult.summary}</p>

        <div className="reasoningMetaGrid">
          <div>
            <span>Confidence ceiling</span>
            <strong>{Math.round(reasoningResult.packet.confidenceCeiling * 100)}%</strong>
          </div>
          <div>
            <span>Evidence sources</span>
            <strong>{reasoningResult.availableSources.length}/4</strong>
          </div>
          <div>
            <span>Supporting evidence</span>
            <strong>{reasoningResult.packet.hypothesis.evidenceIds.length}</strong>
          </div>
          <div>
            <span>Candidate count</span>
            <strong>{reasoningResult.candidates.length}</strong>
          </div>
        </div>

        {reasoningResult.candidates.length > 0 && (
          <div className="hypothesisList">
            {reasoningResult.candidates.slice(0, 4).map((candidate, index) => (
              <article className="hypothesisCard" key={candidate.candidateId}>
                <div className="candidateTopline">
                  <div>
                    <span className="sectionLabel">
                      {index === 0 ? "Leading candidate" : `Candidate ${index + 1}`}
                    </span>
                    <strong>{candidate.title}</strong>
                  </div>
                  <span className={`candidateScore ${scoreClass(Math.round(candidate.confidence * 100))}`}>
                    {Math.round(candidate.confidence * 100)}%
                  </span>
                </div>

                <div className="agentSignalRow">
                  <span>Repo {candidate.repositoryScore}/100</span>
                  <span>CI {candidate.ciSignal}</span>
                  <span>Logs {candidate.logSignal}</span>
                  <span>DB {candidate.databaseSignal}</span>
                </div>

                {candidate.supportingReasons.length > 0 && (
                  <ul>
                    {candidate.supportingReasons.slice(0, 5).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}

                {candidate.contradictions.length > 0 && (
                  <div className="reasoningContradictions">
                    <strong>Contradictions</strong>
                    {candidate.contradictions.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                )}

                <a className="inlineLink" href={candidate.url} target="_blank" rel="noreferrer">
                  Inspect candidate ↗
                </a>
                <div className="evidenceLinks" aria-label="Candidate evidence references">
                  {candidate.supportingEvidenceIds.map((id) => <a key={id} href={`#evidence-${id}`}>{id}</a>)}
                  {candidate.contradictingEvidenceIds.map((id) => <a key={id} href={`#evidence-${id}`}>Contradiction: {id}</a>)}
                </div>
              </article>
            ))}
          </div>
        )}

        {(reasoningResult.packet.hypothesis.contradictions.length > 0 ||
          reasoningResult.packet.hypothesis.missingEvidence.length > 0) && (
          <div className="twoColumn">
            <div className="callout warn">
              <span className="sectionLabel">Contradictions</span>
              {reasoningResult.packet.hypothesis.contradictions.length > 0 ? (
                reasoningResult.packet.hypothesis.contradictions.map((item) => (
                  <p key={item}>{item}</p>
                ))
              ) : (
                <p>No material contradictions detected.</p>
              )}
            </div>
            <div className="callout">
              <span className="sectionLabel">Missing evidence</span>
              {reasoningResult.packet.hypothesis.missingEvidence.length > 0 ? (
                reasoningResult.packet.hypothesis.missingEvidence.map((item) => (
                  <p key={item}>{item}</p>
                ))
              ) : (
                <p>No critical evidence gaps remain.</p>
              )}
            </div>
          </div>
        )}
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

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">CI Agent</span>
            <h2>GitHub Actions correlation</h2>
          </div>
          {ciReady && (
            <span className="statusBadge">{ciResult.inspectedRuns} workflow runs inspected</span>
          )}
        </div>

        {ciResult.status === "error" ? (
          <div className="providerError">
            <strong>CI inspection failed</strong>
            <p>{ciResult.error}</p>
          </div>
        ) : (
          <>
            <p className="muted">{ciResult.summary}</p>

            {ciResult.findings.length > 0 ? (
              <div className="ciFindingList">
                {ciResult.findings.map((finding) => (
                  <article className="ciFindingCard" key={finding.candidateId}>
                    <div className="candidateTopline">
                      <div>
                        <span className="sectionLabel">Candidate</span>
                        <strong>{finding.candidateTitle}</strong>
                      </div>
                      <span className={`ciSignal ${signalClass(finding.signal)}`}>
                        {finding.signal}
                      </span>
                    </div>

                    <p>{finding.summary}</p>

                    {finding.matchedRuns.length > 0 ? (
                      <div className="workflowRunList">
                        {finding.matchedRuns.map((run) => (
                          <div className="workflowRun" key={run.id}>
                            <div className="workflowRunHeader">
                              <div>
                                <strong>{run.name}</strong>
                                <span>{run.event} · {run.conclusion ?? "in progress"}</span>
                              </div>
                              <a href={run.htmlUrl} target="_blank" rel="noreferrer">
                                Open run ↗
                              </a>
                            </div>

                            <div className="ciMetaGrid">
                              <div>
                                <span>Detected validation</span>
                                <strong>
                                  {run.validationCategories.length
                                    ? run.validationCategories.join(", ")
                                    : "None detected"}
                                </strong>
                              </div>
                              <div>
                                <span>Missing validation</span>
                                <strong>
                                  {run.missingValidationCategories.length
                                    ? run.missingValidationCategories.join(", ")
                                    : "None"}
                                </strong>
                              </div>
                            </div>

                            {run.failedJobs.length > 0 && (
                              <div className="failureBox">
                                <strong>Failed jobs</strong>
                                <span>{run.failedJobs.join(", ")}</span>
                              </div>
                            )}

                            {run.failedSteps.length > 0 && (
                              <div className="failureBox">
                                <strong>Failed steps</strong>
                                <span>{run.failedSteps.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No workflow run matched SHA {finding.candidateSha.slice(0, 7)}.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyQueue">
                <strong>No CI findings to correlate.</strong>
                <p className="muted">
                  DevRelay needs a sufficiently relevant repository candidate before CI can strengthen or weaken it.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Log Agent</span>
            <h2>Runtime log correlation</h2>
          </div>
          {logResult.status === "complete" && (
            <span className="statusBadge">{logResult.entriesInspected} log entries inspected</span>
          )}
        </div>

        {logResult.status === "unconfigured" ? (
          <div className="providerNotice">
            <strong>Runtime logs are not connected yet</strong>
            <p>{logResult.error}</p>
            <code>LOG_SOURCE_URL=https://your-read-only-log-adapter.example/query</code>
            <div className="providerActions">
              <Link className="inlineLink" href="/integrations">Configure evidence sources →</Link>
            </div>
          </div>
        ) : logResult.status === "error" ? (
          <div className="providerError">
            <strong>Runtime log inspection failed</strong>
            <p>{logResult.error}</p>
          </div>
        ) : (
          <>
            <p className="muted">{logResult.summary}</p>

            {logResult.signatures.length > 0 && (
              <div className="signatureGrid">
                {logResult.signatures.slice(0, 6).map((signature) => (
                  <article className="signatureCard" key={signature.signature}>
                    <div className="candidateTopline">
                      <span className="statusBadge">{signature.level}</span>
                      <strong>{signature.count}×</strong>
                    </div>
                    <p>{signature.sample}</p>
                    <div className="signatureTimes">
                      <span>First: {new Date(signature.firstSeen).toLocaleString()}</span>
                      <span>Last: {new Date(signature.lastSeen).toLocaleString()}</span>
                    </div>
                    {signature.traceIds.length > 0 && (
                      <code>{signature.traceIds[0]}</code>
                    )}
                  </article>
                ))}
              </div>
            )}

            {logResult.findings.length > 0 && (
              <div className="ciFindingList">
                {logResult.findings.map((finding) => (
                  <article className="ciFindingCard" key={finding.candidateId}>
                    <div className="candidateTopline">
                      <div>
                        <span className="sectionLabel">Repository candidate</span>
                        <strong>{finding.candidateTitle}</strong>
                      </div>
                      <div className="signalStack">
                        <span className={`ciSignal ${signalClass(finding.signal)}`}>
                          {finding.signal}
                        </span>
                        <span className="runtimeScore">{finding.supportScore}/100 runtime support</span>
                      </div>
                    </div>

                    <p>{finding.summary}</p>

                    {finding.reasons.length > 0 && (
                      <ul>
                        {finding.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panelTitle">
          <div>
            <span className="sectionLabel">Database Agent</span>
            <h2>Database infrastructure telemetry</h2>
          </div>
          {databaseResult.status === "complete" && databaseResult.snapshot && (
            <span className="statusBadge">
              {databaseResult.snapshot.provider} · {databaseResult.snapshot.database}
            </span>
          )}
        </div>

        {databaseResult.status === "unconfigured" ? (
          <div className="providerNotice">
            <strong>Database telemetry is not connected yet</strong>
            <p>{databaseResult.error}</p>
            <code>DB_TELEMETRY_URL=https://your-read-only-db-health.example/health</code>
            <div className="providerActions">
              <Link className="inlineLink" href="/integrations">Configure evidence sources →</Link>
            </div>
          </div>
        ) : databaseResult.status === "error" ? (
          <div className="providerError">
            <strong>Database telemetry inspection failed</strong>
            <p>{databaseResult.error}</p>
          </div>
        ) : databaseResult.snapshot ? (
          <>
            <p className="muted">{databaseResult.summary}</p>

            <div className="dbMetricGrid">
              <article>
                <span>Connections</span>
                <strong>
                  {databaseResult.snapshot.connections.active}/
                  {databaseResult.snapshot.connections.max}
                </strong>
                <small>
                  {databaseResult.snapshot.connections.utilizationPercent}% utilized
                </small>
              </article>
              <article>
                <span>Waiting</span>
                <strong>{databaseResult.snapshot.connections.waiting}</strong>
                <small>sessions waiting</small>
              </article>
              <article>
                <span>Blocked</span>
                <strong>{databaseResult.snapshot.locks.blockedSessions}</strong>
                <small>blocked sessions</small>
              </article>
              <article>
                <span>Long queries</span>
                <strong>{databaseResult.snapshot.queries.longRunning}</strong>
                <small>
                  longest {databaseResult.snapshot.queries.longestSeconds}s
                </small>
              </article>
            </div>

            {databaseResult.snapshot.waits.length > 0 && (
              <div className="waitEventList">
                {databaseResult.snapshot.waits
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 6)
                  .map((wait) => (
                    <div key={`${wait.type}-${wait.event}`}>
                      <code>{wait.type}/{wait.event}</code>
                      <strong>{wait.count}</strong>
                    </div>
                  ))}
              </div>
            )}

            {databaseResult.findings.length > 0 && (
              <div className="ciFindingList">
                {databaseResult.findings.map((finding) => (
                  <article className="ciFindingCard" key={finding.candidateId}>
                    <div className="candidateTopline">
                      <div>
                        <span className="sectionLabel">Repository candidate</span>
                        <strong>{finding.candidateTitle}</strong>
                      </div>
                      <div className="signalStack">
                        <span className={`ciSignal ${signalClass(finding.signal)}`}>
                          {finding.signal}
                        </span>
                        <span className="runtimeScore">
                          {finding.supportScore}/100 database support
                        </span>
                      </div>
                    </div>

                    <p>{finding.summary}</p>

                    {finding.reasons.length > 0 && (
                      <ul>
                        {finding.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>

      <InvestigationReview run={run} history={history} />
    </>
  );
}
