"use client";

import Link from "next/link";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>This view couldn’t load</h1>
      <p className="muted">Try loading it again, or return to the incident queue to continue.</p>
      <div className="approvalActions">
        <button type="button" onClick={reset}>Try again</button>
        <Link className="secondaryButton" href="/incidents">Return to incident queue</Link>
      </div>
    </section>
  );
}
