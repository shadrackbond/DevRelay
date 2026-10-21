function statusFor(agent: string): { label: string; className: string } {
  if (agent === "Log Agent") {
    return process.env.LOG_SOURCE_URL
      ? { label: "Ready", className: "done" }
      : { label: "Needs source", className: "waiting" };
  }

  if (agent === "Database Agent") {
    return process.env.DB_TELEMETRY_URL
      ? { label: "Ready", className: "done" }
      : { label: "Needs source", className: "waiting" };
  }

  if (agent === "Repository Agent" || agent === "CI Agent") {
    return process.env.GITHUB_TOKEN
      ? { label: "Ready", className: "done" }
      : { label: "Public-only", className: "waiting" };
  }

  return { label: "Ready", className: "done" };
}

const agents = [
  ["Coordinator Agent", "Plans and delegates investigation work"],
  ["Repository Agent", "Inspects code and recent changes"],
  ["CI Agent", "Reads build and test signals"],
  ["Log Agent", "Analyzes runtime logs"],
  ["Database Agent", "Inspects database health"],
  ["Reasoning Agent", "Correlates evidence into hypotheses"],
] as const;

export const metadata = { title: "Agent registry" };

export default function AgentsPage() {
  return (
    <>
      <header className="pageHeader">
        <div>
          <h1>Agent registry</h1>
          <p className="muted">Specialized agents participating in DevRelay investigations.</p>
        </div>
      </header>
      <div className="cardGrid">
        {agents.map(([name, description]) => {
          const status = statusFor(name);
          return (
            <article className="panel" key={name}>
              <span className={status.className}>{status.label}</span>
              <h2>{name}</h2>
              <p className="muted">{description}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
