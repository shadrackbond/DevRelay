
const agents = [
  ["Coordinator Agent", "Plans and delegates investigation work", "Ready"],
  ["Repository Agent", "Inspects code and recent changes", "Ready"],
  ["CI Agent", "Reads build and test signals", "Ready"],
  ["Log Agent", "Analyzes runtime logs", "Ready"],
  ["Database Agent", "Inspects database health", "Ready"],
  ["Reasoning Agent", "Correlates evidence into hypotheses", "Ready"],
];

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
        {agents.map(([name, description, status]) => (
          <article className="panel" key={name}>
            <span className="done">{status}</span>
            <h2>{name}</h2>
            <p className="muted">{description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
