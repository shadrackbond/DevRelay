import {
  renderAllBorderlessRelayViews,
  type CanonicalReasoningPacket,
} from "@devrelay/core";
import { RelayMessage } from "./RelayMessage";

export function BorderlessRelay({ packet }: { packet: CanonicalReasoningPacket }) {
  const views = renderAllBorderlessRelayViews(packet);

  return (
    <section className="panel" id="relay" aria-labelledby="relay-title">
      <div className="panelTitle">
        <div>
          <span className="sectionLabel">Borderless Relay</span>
          <h2 id="relay-title">One diagnosis. Ready to share.</h2>
        </div>
        <span className="invariantBadge">✓ Same verified diagnosis</span>
      </div>
      <p className="muted">
        Choose a message format. The evidence, confidence, known gaps, and approval requirements stay the same.
      </p>
      <RelayMessage views={views} incidentId={packet.incident.id} />
    </section>
  );
}
