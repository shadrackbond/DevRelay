import type { CanonicalReasoningPacket } from "@devrelay/core";

function timestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) return "Time unavailable";
  return `${new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })} UTC`;
}

export function InvestigationEvidence({ packet }: { packet: CanonicalReasoningPacket }) {
  return (
    <section className="panel" id="evidence" aria-labelledby="evidence-title">
      <div className="panelTitle">
        <div>
          <span className="sectionLabel">Evidence & provenance</span>
          <h2 id="evidence-title">Behind the diagnosis</h2>
        </div>
        <span className="statusBadge">{packet.evidence.length} evidence items</span>
      </div>
      <p className="muted">Inspect the sources, observation times, and freshness behind this investigation.</p>
      {packet.evidence.length === 0 ? (
        <div className="emptyReasoningState"><strong>No accepted evidence yet.</strong><p className="muted">Connect the missing sources or resolve provider errors above. DevRelay will retain an insufficient-evidence result until a candidate is corroborated.</p></div>
      ) : (
        <div className="evidenceGrid">
          {packet.evidence.map((item) => (
            <article className="evidenceCard" key={item.id} id={`evidence-${item.id}`} tabIndex={-1}>
              <div className="evidenceHeader">
                <strong>{item.kind === "repository" ? "Repository" : item.kind === "ci" ? "CI/CD" : item.kind === "logs" ? "Runtime logs" : item.kind === "database" ? "Database" : item.kind}</strong>
                <span className={item.freshness === "fresh" ? "fresh" : item.freshness === "stale" ? "waiting" : "statusBadge"}>{item.freshness}</span>
              </div>
              <p>{item.summary}</p>
              <dl className="evidenceFacts">
                <div><dt>Reference</dt><dd><code>{item.id}</code></dd></div>
                <div><dt>Source</dt><dd>{item.source}</dd></div>
                <div><dt>Observed</dt><dd><time dateTime={item.observedAt}>{timestamp(item.observedAt)}</time></dd></div>
                <div><dt>Role</dt><dd>{packet.hypothesis.evidenceIds.includes(item.id) ? "Supports hypothesis" : item.metadata?.signal === "contradicts" ? "Contradicts candidate" : "Context"}</dd></div>
              </dl>
              {item.metadata?.simulated === true && <span className="waiting">Simulated</span>}
              {item.uri && (/^https?:\/\//.test(item.uri)
                ? <a className="inlineLink" href={item.uri} target="_blank" rel="noreferrer">Open source ↗</a>
                : <code className="evidenceUri">{item.uri}</code>)}
            </article>
          ))}
        </div>
      )}

      <details className="investigationAudit">
        <summary>Audit trail · {packet.audit.length} events</summary>
        <p className="smallText">Packet generated <time dateTime={packet.generatedAt}>{timestamp(packet.generatedAt)}</time></p>
        <ol>
          {packet.audit.map((entry, index) => (
            <li key={`${entry.actor}-${entry.action}-${index}`}>
              <time dateTime={entry.timestamp}>{timestamp(entry.timestamp)}</time>
              <strong>{entry.actor}</strong>
              <span>{entry.action.replaceAll("-", " ")}</span>
              <div className="evidenceLinks">{entry.evidenceIds?.map((id) => <a key={id} href={`#evidence-${id}`}>{id}</a>)}</div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
