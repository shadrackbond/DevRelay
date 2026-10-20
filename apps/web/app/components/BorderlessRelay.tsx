import {
  renderAllBorderlessRelayViews,
  type CanonicalReasoningPacket,
} from "@devrelay/core";

export function BorderlessRelay({
  packet,
}: {
  packet: CanonicalReasoningPacket;
}) {
  const views = renderAllBorderlessRelayViews(packet);

  return (
    <section className="panel" id="relay" aria-labelledby="relay-title">
      <div className="panelTitle">
        <div>
          <span className="sectionLabel">Borderless Relay</span>
          <h2 id="relay-title">One reasoning state. Multiple representations.</h2>
        </div>
        <span className="invariantBadge">
          invariant {views[0]?.packetInvariantId}
        </span>
      </div>

      <p className="muted">
        Every view below is rendered from the same Canonical Reasoning Packet.
        Confidence, evidence references, missing evidence, contradictions, and
        approval requirements are immutable across representations.
      </p>

      <div className="relayGrid">
        {views.map((view) => (
          <article
            className={`relayCard ${view.mode === "low-bandwidth" ? "lowBandwidth" : ""}`}
            key={view.mode}
          >
            <div className="relayHeader">
              <div>
                <span>{view.title}</span>
                <small lang={view.locale}>{view.subtitle}</small>
              </div>
              <b>✓ verified</b>
            </div>

            <strong>{view.canonicalDiagnosis}</strong>

            {view.compactText ? (
              <pre>{view.compactText}</pre>
            ) : (
              <p lang={view.locale}>{view.presentation}</p>
            )}

            <div className="relayInvariantGrid">
              <div>
                <span>Confidence</span>
                <strong>{Math.round(view.confidence * 100)}%</strong>
              </div>
              <div>
                <span>Ceiling</span>
                <strong>{Math.round(view.confidenceCeiling * 100)}%</strong>
              </div>
              <div>
                <span>Evidence refs</span>
                <strong>{view.evidenceIds.length}</strong>
              </div>
              <div>
                <span>Approval</span>
                <strong>
                  {view.safetyGate === "human-approval-required"
                    ? "Required"
                    : "Not required"}
                </strong>
              </div>
            </div>

            {(view.missingEvidence.length > 0 ||
              view.contradictions.length > 0) && (
              <div className="relayWarnings">
                {view.missingEvidence.length > 0 && (
                  <span>{view.missingEvidence.length} evidence gap(s)</span>
                )}
                {view.contradictions.length > 0 && (
                  <span>{view.contradictions.length} contradiction(s)</span>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
