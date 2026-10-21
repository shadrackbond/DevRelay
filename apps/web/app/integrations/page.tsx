function sourceStatus(name: string): { label: string; className: string; detail: string } {
  if (name === "GitHub" || name === "GitHub Actions") {
    return {
      label: process.env.GITHUB_TOKEN ? "Configured" : "Public-only",
      className: process.env.GITHUB_TOKEN ? "done" : "waiting",
      detail: process.env.GITHUB_TOKEN
        ? "Authenticated GitHub access is configured."
        : "Public repositories work, but private access and higher rate limits require GITHUB_TOKEN.",
    };
  }

  if (name === "Runtime Logs") {
    return process.env.LOG_SOURCE_URL
      ? { label: "Configured", className: "done", detail: "Runtime log source is configured." }
      : { label: "Not configured", className: "waiting", detail: "Set LOG_SOURCE_URL or use simulated://checkout for the demo." };
  }

  return process.env.DB_TELEMETRY_URL
    ? { label: "Configured", className: "done", detail: "Database telemetry source is configured." }
    : { label: "Not configured", className: "waiting", detail: "Set DB_TELEMETRY_URL or use simulated://checkout for the demo." };
}

const integrations = [
  ["GitHub", "Repository metadata, commits, pull requests, and changed files"],
  ["GitHub Actions", "Workflow runs, jobs, failed steps, and validation coverage"],
  ["Runtime Logs", "Vendor-neutral HTTP runtime log ingestion and signature correlation"],
  ["PostgreSQL", "Read-only connection, lock, wait, and long-query telemetry"],
] as const;

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
        {integrations.map(([name, description]) => {
          const status = sourceStatus(name);
          return (
            <article className="panel" key={name}>
              <div className="panelTitle">
                <h2>{name}</h2>
                <span className={status.className}>{status.label}</span>
              </div>
              <p className="muted">{description}</p>
              <div className="integrationDetails">
                <span>{status.detail}</span>
                <span>
                  {name === "Runtime Logs"
                    ? "Optional LOG_SOURCE_TOKEN bearer auth"
                    : name === "PostgreSQL"
                      ? "Optional DB_TELEMETRY_TOKEN bearer auth"
                      : "Private repositories require GITHUB_TOKEN"}
                </span>
                <span>Read-only investigation</span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
