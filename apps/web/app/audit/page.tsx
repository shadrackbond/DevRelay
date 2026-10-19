import { runCheckoutInvestigation } from "@devrelay/core";
import { AppShell } from "../components/AppShell";

export default async function AuditPage() {
  const { packet } = await runCheckoutInvestigation();

  return (
    <AppShell active="Audit Log">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">AUDIT</p>
          <h1>Decision audit trail</h1>
          <p className="muted">Every agent action and policy decision for the demo investigation.</p>
        </div>
      </header>
      <section className="panel">
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
    </AppShell>
  );
}
