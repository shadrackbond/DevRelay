"use client";

import { useState } from "react";

export function ApprovalGate() {
  const [state, setState] = useState<"pending" | "approved" | "rejected">("pending");

  return (
    <div aria-live="polite" aria-atomic="true">
      {state === "pending" ? (
        <div className="approvalGate">
          <div>
            <span className="sectionLabel">Human approval required</span>
            <strong>Reduce CHECKOUT_WORKERS from 80 → 30</strong>
            <p>Try the approval flow. This demo does not execute production changes, and your choice resets when you leave.</p>
          </div>
          <div className="approvalActions">
            <button type="button" className="secondaryButton" onClick={() => setState("rejected")}>Reject</button>
            <button type="button" onClick={() => setState("approved")}>Approve mitigation</button>
          </div>
        </div>
      ) : (
        <div className={`approvalResult ${state}`}>
          <strong>{state === "approved" ? "Mitigation approved" : "Mitigation rejected"}</strong>
          <span>Demo decision only. No production changes were made.</span>
          <button type="button" className="secondaryButton" onClick={() => setState("pending")}>Reset demo decision</button>
        </div>
      )}
    </div>
  );
}
