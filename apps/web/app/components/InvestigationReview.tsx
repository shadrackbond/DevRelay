import Link from "next/link";
import type { StoredInvestigation } from "../lib/history-store";
import { rerunInvestigation } from "../actions/investigations";
import { ApprovalGate } from "./ApprovalGate";
import { SubmitInvestigationButton } from "./SubmitInvestigationButton";

export function InvestigationReview({ run, history }: { run: StoredInvestigation; history: StoredInvestigation[] }) {
  const current = history[0];
  const readOnly = current?.id !== run.id;
  return (
    <>
      <ApprovalGate key={run.id} initialPacket={run.packet} runId={run.id} readOnly={readOnly} />
      <section className="panel" id="history" aria-labelledby="history-title">
        <span className="sectionLabel">Saved investigation history</span>
        <h2 id="history-title">{readOnly ? "Viewing an earlier investigation" : "Current investigation"}</h2>
        <p className="muted">Saved results stay the same when you reload. Running again collects a new snapshot and preserves earlier evidence and decisions.</p>
        <ol className="historyList">
          {history.map((item) => (
            <li key={item.id}>
              <Link href={`/incidents/${run.incidentId}?run=${item.id}`} aria-current={item.id === run.id ? "page" : undefined}>
                {new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" })} UTC
                {item.id === current?.id ? " · Current" : " · Historical"}{item.id === run.id ? " · Viewing" : ""}
              </Link>
            </li>
          ))}
        </ol>
        {current && !readOnly && <form action={rerunInvestigation.bind(null, run.incidentId, current.id)}>
          <SubmitInvestigationButton label="Run investigation again" pendingLabel="Investigating…" />
        </form>}
        {readOnly && current && (
          <Link className="primaryButton" href={`/incidents/${run.incidentId}`}>
            Return to current investigation
          </Link>
        )}
        <Link className="inlineLink" href="/audit">Open saved audit history ↗</Link>
      </section>
    </>
  );
}
