import Link from "next/link";
import { runCheckoutInvestigation } from "@devrelay/core";
import { ApprovalGate } from "../../components/ApprovalGate";
import { BorderlessRelay } from "../../components/BorderlessRelay";

export const metadata = { title: "Checkout demo investigation" };

const kindLabel: Record<string, string> = {
  repository: "GitHub",
  ci: "CI/CD",
  logs: "Runtime logs",
  database: "Database",
  monitoring: "Monitoring",
  docs: "Documentation",
};

export default async function IncidentPage() {
  const { packet, stages } = await runCheckoutInvestigation();
  const confidence = Math.round(packet.hypothesis.confidence * 100);


  return (
    <div className="incidentShell">
      <div className="incidentTopbar">
        <Link className="backLink" href="/incidents">← Incident queue</Link>
        <span className="statusBadge">Demo investigation</span>
      </div>

      <section className="incidentHero">
        <div>
          <p className="eyebrow"><span className="critical">Critical</span> Incident #{packet.incident.id}</p>
          <h1>{packet.incident.title}</h1>
          <p className="muted">{packet.incident.description}</p>
        </div>
        <div className="confidenceBadge">
          <strong>{confidence}%</strong>
          <span>confidence</span>
        </div>
      </section>

      <div className="investigationGrid">
        <section className="panel">
          <span className="sectionLabel">Root-cause diagnosis</span>
          <h2 className="rootCause">{packet.hypothesis.statement}</h2>
          <p className="muted">
            DevRelay correlated repository change history, CI coverage, runtime
            failures, and live database pressure.
          </p>

          <div className="evidenceGrid">
            {packet.evidence.map((item) => (
              <article className="evidenceCard" key={item.id}>
                <div className="evidenceHeader">
                  <strong>{kindLabel[item.kind] ?? item.kind}</strong>
                  <span className="fresh">{item.freshness}</span>
                </div>
                <p>{item.summary}</p>
                <code>{item.id}</code>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel">
          <span className="sectionLabel">Investigation timeline</span>
          <div className="timeline">
            {stages.map((stage, index) => (
              <div className="timelineItem" key={stage.agent}>
                <div className="timelineIndex">{index + 1}</div>
                <div>
                  <strong>{stage.label}</strong>
                  <p>{stage.detail}</p>
                  <span className={stage.status === "awaiting-approval" ? "waiting" : "done"}>
                    {stage.status}
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
            <span className="sectionLabel">Evidence reasoning</span>
            <h2>Why DevRelay reached this conclusion</h2>
          </div>
          <span className="confidencePill">{confidence}% confidence</span>
        </div>

        <div className="reasoningChain">
          <div>
            <span>1 · Change</span>
            <strong>PR #483</strong>
            <p>Concurrency increased 4× shortly before incident onset.</p>
          </div>
          <div className="arrow">→</div>
          <div>
            <span>2 · Runtime</span>
            <strong>1,248 timeouts</strong>
            <p>Requests fail while acquiring DB connections.</p>
          </div>
          <div className="arrow">→</div>
          <div>
            <span>3 · Database</span>
            <strong>100/100 active</strong>
            <p>56 additional requests are waiting for a connection.</p>
          </div>
          <div className="arrow">→</div>
          <div>
            <span>4 · Root cause</span>
            <strong>Pool saturation</strong>
            <p>Worker concurrency exceeds safe DB capacity.</p>
          </div>
        </div>

        <div className="twoColumn">
          <div className="callout warn">
            <span className="sectionLabel">Contradiction handled</span>
            <strong>CI was green</strong>
            <p>{packet.hypothesis.contradictions[0]}</p>
          </div>
          <div className="callout">
            <span className="sectionLabel">Missing evidence</span>
            <strong>Still to verify</strong>
            <p>{packet.hypothesis.missingEvidence[0]}</p>
          </div>
        </div>
      </section>

      <section className="panel" id="response">
        <span className="sectionLabel">Recommended response</span>
        <div className="actionList">
          {packet.actions.map((action) => (
            <article key={action.id}>
              <div>
                <strong>{action.description}</strong>
                <p>Risk: {action.risk} · Approval: {action.approval}</p>
              </div>
            </article>
          ))}
        </div>
        <ApprovalGate />
      </section>

      <BorderlessRelay packet={packet} />

      <section className="panel">
        <span className="sectionLabel">Audit trail</span>
        <div className="auditList">
          {packet.audit.map((entry, index) => (
            <div key={index}>
              <code>{new Date(entry.timestamp).toISOString().slice(11, 19)}</code>
              <strong>{entry.actor}</strong>
              <span>{entry.action}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
