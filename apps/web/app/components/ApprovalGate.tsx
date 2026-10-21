"use client";

import { useActionState } from "react";
import { isActionApprovalSatisfied, requiresHumanApproval, type CanonicalReasoningPacket } from "@devrelay/core";
import { decideApproval } from "../actions/approvals";
import { BorderlessRelay } from "./BorderlessRelay";
import { InvestigationEvidence } from "./InvestigationEvidence";

export function ApprovalGate({ initialPacket, runId, readOnly }: { initialPacket: CanonicalReasoningPacket; runId: string; readOnly: boolean }) {
  const [state, submit, pending] = useActionState(async (previous: { packet: CanonicalReasoningPacket; message: string; error: boolean }, formData: FormData) => {
    try {
      const result = await decideApproval(runId, formData);
      return { ...result, packet: result.packet ?? previous.packet };
    } catch {
      return { ...previous, error: true, message: "Decision could not be confirmed. Reload to review the proposal. No action was executed." };
    }
  }, { packet: initialPacket, message: "", error: false });

  return (
    <>
      <InvestigationEvidence packet={state.packet} />
      <section className="panel" id="response" aria-labelledby="response-title">
        <span className="sectionLabel">Human approval gate</span>
        <h2 id="response-title">Review the recommended response</h2>
        <p className="muted">Decisions are saved with this investigation and survive reloads. Approval does not execute a change. Reviewer identity is not verified.</p>
        {readOnly && <p className="callout warn">Historical investigation. Decisions are closed; open the current investigation to review its proposals.</p>}
        <div className="actionList">
          {state.packet.actions.map((action) => (
            <article key={action.id}>
              <strong>{action.description}</strong>
              <p>Risk: {action.risk} · Human approval: {requiresHumanApproval(action) ? "Required" : "Not required"} · Decision: {action.approval}</p>
              <p>{isActionApprovalSatisfied(action) ? "Approval satisfied" : "Blocked"} · Execution unavailable</p>
              {!readOnly && requiresHumanApproval(action) && action.approval !== "approved" && action.approval !== "rejected" ? (
                <form action={submit} className="approvalGate" aria-label={`Review: ${action.description}`}>
                  <input type="hidden" name="actionId" value={action.id} />
                  <p>Approve or reject this exact action. No production change will run.</p>
                  <div className="approvalActions">
                    <button type="submit" name="decision" value="rejected" className="secondaryButton" disabled={pending}>Reject action</button>
                    <button type="submit" name="decision" value="approved" disabled={pending}>Approve action</button>
                  </div>
                </form>
              ) : action.approval === "approved" || action.approval === "rejected" ? (
                <div className={`approvalResult ${action.approval}`}><strong>Action {action.approval}</strong><span>Saved decision. No action was executed.</span></div>
              ) : null}
            </article>
          ))}
          {state.packet.actions.length === 0 && <p>No actions are recommended.</p>}
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className={state.error ? "errorState" : "smallText"}>
          {pending ? "Recording decision…" : state.message}
        </p>
      </section>
      <BorderlessRelay packet={state.packet} />
    </>
  );
}
