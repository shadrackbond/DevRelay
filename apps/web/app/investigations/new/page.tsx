import Link from "next/link";
import { NewInvestigationForm } from "../../components/NewInvestigationForm";

export const metadata = { title: "New investigation" };

export default function NewInvestigationPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>New investigation</h1>
          <p className="muted">Tell us what you’re seeing. DevRelay will look for the evidence.</p>
        </div>
      </header>

      <div className="intakeLayout">
        <section className="panel" aria-label="Incident details">
          <NewInvestigationForm />
        </section>
        <aside className="demoShortcut">
          <h2>Start with what you know.</h2>
          <p>Include the first symptoms, the affected service, and any recent changes. You can investigate without knowing the cause.</p>
          <div className="formNotice">
            <strong>You control the response.</strong>
            <p>Evidence collection is read-only. Production changes require human approval.</p>
          </div>
          <h2 className="demoHeading">Want to see an example?</h2>
          <p>Follow the checkout incident from its first signals to a recommended response.</p>
          <Link className="inlineLink" href="/incidents/1042">Open demo investigation</Link>
        </aside>
      </div>
    </>
  );
}
