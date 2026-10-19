"use client";

import { useState } from "react";

export function ApprovalGate() {
  const [state, setState] = useState<"pending" | "approved" | "rejected">("pending");

  if (state === "approved") {
    return <div className="approvalResult approved"><strong>Mitigation approved</strong><span>Action is cleared for the execution adapter.</span></div>;
  }

  if (state === "rejected") {
    return <div className="approvalResult rejected"><strong>Mitigation rejected</strong><span>No production mutation will be performed.</span></div>;
  }

  return (
    <div className="approvalGate">
      <div>
        <span className="sectionLabel">Human approval required</span>
        <strong>Reduce CHECKOUT_WORKERS from 80 → 30</strong>
        <p>This changes production configuration, so DevRelay will not execute it autonomously.</p>
      </div>
      <div className="approvalActions">
        <button className="secondaryButton" onClick={() => setState("rejected")}>Reject</button>
        <button onClick={() => setState("approved")}>Approve mitigation</button>
      </div>
    </div>
  );
}
