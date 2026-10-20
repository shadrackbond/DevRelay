import { AppShell } from "../components/AppShell";

const integrations = [
  ["GitHub", "Repository metadata, commits, pull requests, and changed files", "Live"],
  ["GitHub Actions", "Workflow runs, jobs, failed steps, and validation coverage", "Live"],
  ["Runtime Logs", "Vendor-neutral HTTP runtime log ingestion and signature correlation", "Live"],
  ["PostgreSQL", "Read-only connection, lock, wait, and long-query telemetry", "Live"],
];

export default function IntegrationsPage() {
  return (
    <AppShell active="Integrations">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">INTEGRATIONS</p>
          <h1>Evidence sources</h1>
          <p className="muted">
            Providers that feed normalized evidence into DevRelay investigations.
          </p>
        </div>
      </header>

      <div className="cardGrid">
        {integrations.map(([name, description, status]) => (
          <article className="panel" key={name}>
            <div className="panelTitle">
              <h2>{name}</h2>
              <span className={status === "Live" ? "done" : "statusBadge"}>{status}</span>
            </div>
            <p className="muted">{description}</p>
            {(name === "GitHub" || name === "GitHub Actions" || name === "Runtime Logs" || name === "PostgreSQL") && (
              <div className="integrationDetails">
                <span>{name === "Runtime Logs" ? "Configure LOG_SOURCE_URL" : name === "PostgreSQL" ? "Configure DB_TELEMETRY_URL" : "Configure GITHUB_TOKEN to avoid anonymous rate limits"}</span>
                <span>{name === "Runtime Logs" ? "Optional LOG_SOURCE_TOKEN bearer auth" : name === "PostgreSQL" ? "Optional DB_TELEMETRY_TOKEN bearer auth" : "Private repos: GITHUB_TOKEN required"}</span>
                <span>Read-only investigation</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
