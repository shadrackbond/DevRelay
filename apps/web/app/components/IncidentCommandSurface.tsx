import type { CanonicalReasoningPacket } from "@devrelay/core";
import type { RepositoryAgentResult } from "../lib/repository-agent";
import type { CiAgentResult } from "../lib/ci-agent";
import type { LogAgentResult } from "../lib/log-agent";
import type { DatabaseAgentResult } from "../lib/database-agent";
import type { ReasoningAgentResult } from "../lib/reasoning-agent";

function providerState(status: string): { label: string; tone: string } {
  if (status === "complete") return { label: "verified", tone: "verified" };
  if (status === "unconfigured") return { label: "missing", tone: "missing" };
  return { label: "error", tone: "error" };
}

function truncate(value: string, max = 46): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function IncidentCommandSurface({
  packet,
  repositoryResult,
  ciResult,
  logResult,
  databaseResult,
  reasoningResult,
}: {
  packet: CanonicalReasoningPacket;
  repositoryResult: RepositoryAgentResult;
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
  reasoningResult: ReasoningAgentResult;
}) {
  const candidate = reasoningResult.winningCandidate ?? reasoningResult.candidates[0];
  const repositoryState = providerState(repositoryResult.status);
  const ciState = providerState(ciResult.status);
  const logState = providerState(logResult.status);
  const dbState = providerState(databaseResult.status);
  const action = packet.actions[0];
  const approvalRequired = packet.actions.some((item) => item.approval === "required");
  const confidence = Math.round(packet.hypothesis.confidence * 100);
  const graphReady = reasoningResult.status === "complete" && Boolean(candidate);

  const sourceRows = [
    {
      key: "GH",
      name: "GitHub",
      detail: candidate ? truncate(candidate.title, 34) : repositoryResult.summary,
      state: repositoryState,
    },
    {
      key: "CI",
      name: "CI pipeline",
      detail: ciResult.status === "complete"
        ? `${ciResult.inspectedRuns} workflow run${ciResult.inspectedRuns === 1 ? "" : "s"} inspected`
        : ciResult.summary,
      state: ciState,
    },
    {
      key: "LG",
      name: "Runtime logs",
      detail: logResult.status === "complete"
        ? `${logResult.entriesInspected} entries inspected`
        : logResult.summary,
      state: logState,
    },
    {
      key: "DB",
      name: "Database metrics",
      detail: databaseResult.snapshot
        ? `${databaseResult.snapshot.connections.utilizationPercent}% connection utilization`
        : databaseResult.summary,
      state: dbState,
    },
  ];

  const observe = logResult.status === "complete" && logResult.signatures[0]
    ? truncate(logResult.signatures[0].sample, 42)
    : truncate(packet.incident.description, 42);
  const link = candidate ? truncate(candidate.title, 42) : "No code-change candidate promoted";
  const corroborate = databaseResult.status === "complete" && databaseResult.snapshot
    ? `DB ${databaseResult.snapshot.connections.utilizationPercent}% utilized; ${databaseResult.snapshot.connections.waiting} waiting`
    : logResult.status === "complete"
      ? "Runtime evidence collected; DB signal unavailable"
      : "Production corroboration is incomplete";
  const recommend = action ? truncate(action.description, 44) : "Collect missing evidence before remediation";

  return (
    <section className="incidentCommandSurface" aria-labelledby="incident-workspace-title">
      <div className="incidentCommandHeader">
        <div>
          <span className="sectionLabel">Incident workspace</span>
          <h2 id="incident-workspace-title">Evidence → causal hypothesis → controlled response</h2>
        </div>
        <span className={graphReady ? "incidentConfidence verified" : "incidentConfidence partial"}>
          {confidence}% confidence
        </span>
      </div>

      <div className="incidentCommandGrid">
        <aside className="incidentSourcePanel">
          <div className="commandPanelHeading">
            <div>
              <h3>Evidence sources</h3>
              <span>Provenance preserved</span>
            </div>
          </div>

          <div className="sourceStack">
            {sourceRows.map((source) => (
              <div className="sourceRow" key={source.key}>
                <span className="sourceIcon">{source.key}</span>
                <div>
                  <strong>{source.name}</strong>
                  <small>{source.detail}</small>
                </div>
                <span className={`sourceState ${source.state.tone}`}>{source.state.label}</span>
              </div>
            ))}
          </div>

          <div className="agentPermissionBlock">
            <strong>Agent permissions</strong>
            <div><span>Read external tools</span><b className="verified">Allowed</b></div>
            <div><span>Production changes</span><b className="missing">{approvalRequired ? "Approval" : "Read-only"}</b></div>
          </div>
        </aside>

        <div className="incidentGraphColumn">
          <article className="incidentGraphPanel">
            <div className="commandPanelHeading">
              <div>
                <h3>Evidence graph</h3>
                <span>Why DevRelay believes this hypothesis is causal</span>
              </div>
              <span className={graphReady ? "sourceState verified" : "sourceState missing"}>
                {graphReady ? `${confidence}% confidence` : "not promoted"}
              </span>
            </div>

            <div className="causalGraph" role="img" aria-label="Causal evidence graph">
              <svg className="causalGraphLines" viewBox="0 0 760 360" preserveAspectRatio="none" aria-hidden="true">
                <path d="M170 70 C260 70 265 150 360 150" />
                <path d="M590 70 C500 70 495 150 400 150" />
                <path d="M170 275 C260 275 265 195 360 195" />
                <path d="M590 275 C500 275 495 195 400 195" />
                <path d="M380 210 L380 300" />
              </svg>

              <div className="graphNode graphRepo">
                <small>Repository</small>
                <strong>{candidate ? truncate(candidate.title, 27) : "No strong repository candidate"}</strong>
                <span>{candidate ? `${candidate.repositoryScore}/100 correlation` : repositoryState.label}</span>
              </div>

              <div className="graphNode graphRuntime">
                <small>Runtime logs</small>
                <strong>
                  {logResult.status === "complete" && logResult.signatures[0]
                    ? truncate(logResult.signatures[0].sample, 27)
                    : "Runtime signal unavailable"}
                </strong>
                <span>{logResult.status === "complete" ? `${logResult.entriesInspected} entries` : logState.label}</span>
              </div>

              <div className="graphNode graphCi">
                <small>CI validation</small>
                <strong>
                  {ciResult.status === "complete" && ciResult.findings[0]
                    ? truncate(ciResult.findings[0].summary, 27)
                    : "CI signal unavailable"}
                </strong>
                <span>{ciResult.status === "complete" ? `${ciResult.inspectedRuns} runs` : ciState.label}</span>
              </div>

              <div className="graphNode graphDb">
                <small>Database</small>
                <strong>
                  {databaseResult.snapshot
                    ? `${databaseResult.snapshot.connections.utilizationPercent}% pool utilization`
                    : "Database signal unavailable"}
                </strong>
                <span>{databaseResult.snapshot ? `${databaseResult.snapshot.connections.waiting} waiting` : dbState.label}</span>
              </div>

              <div className={`graphHypothesis ${graphReady ? "promoted" : "abstained"}`}>
                <small>{graphReady ? "Causal hypothesis" : "Investigation state"}</small>
                <strong>{truncate(packet.hypothesis.statement, 48)}</strong>
                <span>{graphReady ? "independent evidence corroborated" : "insufficient corroboration"}</span>
              </div>

              <div className={`graphRootCause ${graphReady ? "promoted" : "abstained"}`}>
                <strong>{graphReady ? "ROOT CAUSE: PROMOTED" : "ROOT CAUSE: NOT PROMOTED"}</strong>
                <span>{packet.hypothesis.evidenceIds.length} supporting evidence reference(s)</span>
              </div>
            </div>
          </article>

          <article className="reasoningTrailPanel">
            <div className="commandPanelHeading">
              <div>
                <h3>Reasoning trail</h3>
                <span>Challengeable and evidence-bounded</span>
              </div>
              <a href="#evidence">View evidence ↓</a>
            </div>
            <div className="reasoningTrailSteps">
              <div><span>1 · Observe</span><strong>{observe}</strong></div>
              <div><span>2 · Link</span><strong>{link}</strong></div>
              <div><span>3 · Corroborate</span><strong>{corroborate}</strong></div>
              <div><span>4 · Recommend</span><strong>{recommend}</strong></div>
            </div>
          </article>
        </div>

        <aside className="recommendedActionPanel">
          <div className="commandPanelHeading">
            <div>
              <h3>Recommended action</h3>
              <span>Generated from verified evidence</span>
            </div>
            <span className={approvalRequired ? "sourceState missing" : "sourceState verified"}>
              {approvalRequired ? "Human gate" : "Read-only"}
            </span>
          </div>

          <p className="recommendedActionLead">
            {action?.description ?? "Collect the missing evidence before taking a production action."}
          </p>

          <div className="recommendedActionList">
            <strong>Action plan</strong>
            <ol>
              {packet.actions.length > 0 ? packet.actions.map((item) => (
                <li key={item.id}>{item.description}</li>
              )) : (
                <li>Connect missing evidence sources and rerun the investigation.</li>
              )}
            </ol>
          </div>

          <div className="approvalWhy">
            <strong>{approvalRequired ? "Why approval is required" : "Safety state"}</strong>
            <span>
              {approvalRequired
                ? "DevRelay can investigate autonomously, but production-impacting changes stay behind a human decision."
                : "This investigation currently recommends only non-production or read-only actions."}
            </span>
          </div>

          <a className="primaryButton commandActionButton" href="#response">
            Review response
          </a>

          <div className="commandMeta">
            <span>Evidence refs <b>{packet.hypothesis.evidenceIds.length}</b></span>
            <span>Missing <b>{packet.hypothesis.missingEvidence.length}</b></span>
            <span>Contradictions <b>{packet.hypothesis.contradictions.length}</b></span>
          </div>
        </aside>
      </div>
    </section>
  );
}
