import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel">
      <span className="sectionLabel">Page not found</span>
      <h1>There’s nothing here yet</h1>
      <p className="muted">Check the address or return to the queue. Incidents you create are available in the browser where you saved them.</p>
      <Link className="primaryButton" href="/incidents">Return to incident queue</Link>
    </section>
  );
}
