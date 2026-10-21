import Link from "next/link";
import { runCheckoutInvestigation } from "@devrelay/core";
import { latestInvestigation } from "./lib/history-store";
import { getWorkspaceId, listStoredIncidents } from "./lib/incident-store";

export const metadata = { title: "Command center" };

export default async function Home() {
  const [{ packet: seedPacket, stages }, stored, saved] = await Promise.all([
    runCheckoutInvestigation(),
    listStoredIncidents(),
    getWorkspaceId().then((owner) => latestInvestigation(owner, "1042")),
  ]);

  const packet = saved?.packet ?? seedPacket;
  const mitigation = packet.actions.find((action) => action.id === "action-reduce-workers");
  const decision = mitigation?.approval;

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Command center</h1>
          <p className="muted">From the first signal to a response you can trust.</p>
        </div>
        <Link className="primaryButton" href="/investigations/new"><span aria-hidden="true">+</span> New investigation</Link>
      </header>

      <section className="overviewStrip" aria-label="Workspace overview">
        <div><strong>{stored.length}</strong><span>Your incidents</span></div>
        <div><strong>1</strong><span>Demo investigation</span></div>
        <div><strong>{packet.evidence.length}</strong><span>Demo evidence sources</span></div>
        <Link href="/incidents">View incident queue <span aria-hidden="true">↗</span></Link>
      </section>

      <div className="sectionHeading"><h2>Needs your attention</h2><span className="muted">Demo scenario</span></div>
      <div className="grid">
        <article className="panel priorityIncident">
          <div className="incidentMeta"><span className="critical">Critical</span><span>#1042</span><span>{packet.incident.service}</span></div>
          <h2><Link className="incidentLink" href="/incidents/1042">{packet.incident.title}</Link></h2>
          <p className="muted">{packet.incident.description}</p>
          <div className="diagnosis">
            <div className="panelTitle"><span className="sectionLabel">Root-cause hypothesis</span><span className="confidencePill">{Math.round(packet.hypothesis.confidence * 100)}% confidence</span></div>
            <h3>Database connection pool saturation</h3>
            <p>{packet.hypothesis.statement}</p>
          </div>
          <div className="evidenceSummary">
            <div><span>Code change</span><strong>PR #483</strong></div>
            <div><span>DB timeouts</span><strong>1,248</strong></div>
            <div><span>Connections</span><strong>100 / 100</strong></div>
            <div><span>CI coverage</span><strong>Gap found</strong></div>
          </div>
          <div className="panelFooter"><span className="done">Investigation ready</span><Link className="inlineLink" href="/incidents/1042">Explore the evidence <span aria-hidden="true">↗</span></Link></div>
        </article>

        <aside className="responsePanel" aria-label="Recommended response">
          <span className="waiting">{decision === "approved" ? "Mitigation approved" : decision === "rejected" ? "Mitigation rejected" : "Approval required"}</span>
          <h2>A clear next step.<br />You make the call.</h2>
          <p>Reduce checkout worker concurrency to relieve pressure on the database.</p>
          <div className="workerChange"><span>Workers</span><div><s>80</s><span aria-hidden="true">→</span><strong>30</strong></div></div>
          <Link className="primaryButton" href="/incidents/1042#response">Review recommended response</Link>
          <p className="smallText">Demo only. Approval does not change production.</p>
        </aside>
      </div>

      <div className="dashboardBottom">
        <section className="panel">
          <div className="panelTitle"><h2>Investigation team</h2><Link className="inlineLink" href="/agents">View agents</Link></div>
          <p className="muted">Specialists working from the same evidence.</p>
          <ul className="agentList">
            {stages.slice(0, 5).map((stage) => (
              <li key={stage.agent}><span>{stage.label}</span><span className="done">Complete</span></li>
            ))}
          </ul>
        </section>
        <section className="relayIntro">
          <div className="relaySymbol" aria-hidden="true"><span /><span /><span /></div>
          <h2>One diagnosis.<br />A shared understanding.</h2>
          <p className="muted">Technical detail, plain language, Kiswahili, or low-bandwidth text. The evidence stays the same.</p>
          <Link className="inlineLink" href="/incidents/1042#relay">Explore borderless relay <span aria-hidden="true">↗</span></Link>
        </section>
      </div>
    </>
  );
}
