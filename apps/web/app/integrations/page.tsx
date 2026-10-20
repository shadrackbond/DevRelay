
const integrations = [
  ["GitHub", "Repository metadata, commits, pull requests, and changed files", "Available"],
  ["GitHub Actions", "CI/CD run evidence", "Next"],
  ["Runtime Logs", "Application failure signals", "Planned"],
  ["PostgreSQL", "Connection-pool and query-health signals", "Planned"],
];

export const metadata = { title: "Evidence sources" };

export default function IntegrationsPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
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
              <span className={status === "Available" ? "done" : "statusBadge"}>{status}</span>
            </div>
            <p className="muted">{description}</p>
            {name === "GitHub" && (
              <div className="integrationDetails">
                <span>Public repos: no token required</span>
                <span>Private repos: GITHUB_TOKEN required</span>
                <span>Read-only investigation</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
