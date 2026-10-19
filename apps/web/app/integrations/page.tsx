import { AppShell } from "../components/AppShell";

const integrations = [
  ["GitHub", "Repository and pull-request evidence", "Demo adapter"],
  ["GitHub Actions", "CI/CD run evidence", "Demo adapter"],
  ["Runtime Logs", "Application failure signals", "Simulated"],
  ["PostgreSQL", "Connection-pool health", "Simulated"],
];

export default function IntegrationsPage() {
  return (
    <AppShell active="Integrations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INTEGRATIONS</p>
          <h1>Evidence sources</h1>
          <p className="muted">Current providers feeding the DevRelay reasoning pipeline.</p>
        </div>
      </header>
      <div className="cardGrid">
        {integrations.map(([name, description, status]) => (
          <article className="panel" key={name}>
            <div className="panelTitle"><h2>{name}</h2><span className="statusBadge">{status}</span></div>
            <p className="muted">{description}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
