const stats = [
  ["5", "Active incidents"],
  ["3", "Investigating"],
  ["1", "Awaiting approval"],
  ["4", "Connected sources"],
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">◆ DevRelay</div>
        <nav>
          <a className="active">Command Center</a>
          <a>Incidents</a>
          <a>Investigations</a>
          <a>Agents</a>
          <a>Integrations</a>
          <a>Audit Log</a>
        </nav>
      </aside>

      <section className="content">
        <header>
          <div>
            <p className="eyebrow">OMEGA AI AGENTS · AGENT WITHOUT BORDERS</p>
            <h1>Command Center</h1>
            <p className="muted">
              One incident model. Multiple tools, languages, and connectivity conditions.
            </p>
          </div>
          <button>+ New investigation</button>
        </header>

        <div className="stats">
          {stats.map(([value, label]) => (
            <article className="card" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <div className="grid">
          <article className="panel">
            <div className="panelTitle">
              <h2><a className="incidentLink" href="/incidents/1042">Production checkout failing</a></h2>
              <span className="critical">Critical</span>
            </div>
            <p className="muted">Incident #1042 · investigation ready · <a className="inlineLink" href="/incidents/1042">open investigation →</a></p>
            <div className="diagnosis">
              <span>Root-cause hypothesis</span>
              <strong>Database connection pool saturation</strong>
              <p>
                PR #483 increased concurrent database connections beyond the
                production pool limit.
              </p>
              <div className="confidence">91% confidence · 4 evidence sources</div>
            </div>
          </article>

          <article className="panel">
            <h2>Agents</h2>
            <ul className="agentList">
              <li><span>Coordinator</span><b>Planning</b></li>
              <li><span>Repository Agent</span><b>Complete</b></li>
              <li><span>Log Agent</span><b>Complete</b></li>
              <li><span>Reasoning Agent</span><b>Correlating</b></li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
