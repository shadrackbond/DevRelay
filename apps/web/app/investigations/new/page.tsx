import { AppShell } from "../../components/AppShell";
import { NewInvestigationForm } from "../../components/NewInvestigationForm";

export default function NewInvestigationPage() {
  return (
    <AppShell active="Investigations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">NEW INVESTIGATION</p>
          <h1>Create an incident investigation</h1>
          <p className="muted">
            Capture the incident context first. Evidence collection and diagnosis
            happen only after providers are connected.
          </p>
        </div>
      </header>

      <section className="panel newInvestigationCard">
        <NewInvestigationForm />
      </section>

      <section className="panel demoShortcut">
        <span className="sectionLabel">Need the full working demo?</span>
        <h2>Open Incident #1042</h2>
        <p className="muted">
          The deterministic checkout scenario already demonstrates evidence
          correlation, 91% confidence, borderless relay, and human approval.
        </p>
        <a className="inlineLink" href="/incidents/1042">Open demo investigation →</a>
      </section>
    </AppShell>
  );
}
