import { AppShell } from "../../components/AppShell";

export default function NewInvestigationPage() {
  return (
    <AppShell active="Investigations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">NEW INVESTIGATION</p>
          <h1>Start from a known incident</h1>
          <p className="muted">The first end-to-end slice currently supports the deterministic checkout demo.</p>
        </div>
      </header>

      <section className="panel newInvestigationCard">
        <span className="critical">Critical demo</span>
        <h2>Production checkout failing</h2>
        <p className="muted">
          Run the complete repository → CI → logs → database → reasoning → approval workflow.
        </p>
        <div className="demoFacts">
          <span>4 evidence sources</span>
          <span>91% diagnosis confidence</span>
          <span>Human approval gate</span>
        </div>
        <a className="primaryButton" href="/incidents/1042">Run investigation →</a>
      </section>
    </AppShell>
  );
}
