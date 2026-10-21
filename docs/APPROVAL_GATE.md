# Human-approval action gate

Both the checkout demo (`/incidents/1042`) and created investigations use the same
response review. Medium/high-risk actions require approval even if an upstream
action incorrectly says `not-required`. Low-risk actions explicitly marked
`required` are gated too. Rejected actions stay blocked.

## Try it

1. Open the checkout demo and follow **Response**.
2. Confirm the mitigation is blocked and review its description and risk.
3. Choose **Approve action** or **Reject action**. Buttons disable while the
   server records the decision; live feedback confirms the outcome.
4. Inspect the response, expandable audit trail, and all four Relay formats.
   The same action decision appears in each; the approval policy remains
   **Required** even after approval or rejection. Copies/downloads retain it too.
5. Reload to confirm the saved decision. Use **Run investigation again** to try
   the other outcome on a new snapshot. The earlier decision stays in history.

Approval satisfies the proposal's approval check; rejection does not. Neither
outcome executes an action. Missing-evidence investigations only recommend
collecting evidence and offer no unnecessary approval controls.

## Server boundary and limits

The server owns a saved packet snapshot and accepts only its run ID, an action
ID belonging to the snapshot, and an `approved`/`rejected` decision. Access is
scoped to the HTTP-only browser workspace cookie. The browser cannot submit a
replacement packet, description, risk, or prior decision. Replay and conflicting
submissions read current stored state and cannot change a final decision.
Superseded snapshots reject new decisions; a new run never inherits another
snapshot's approval.

The server appends the action ID, description, risk, decision, timestamp, and
`demo-reviewer` actor to the returned packet's audit. The response, evidence audit,
and Relay render that packet together. Diagnosis, evidence, confidence, and the
original packet generation time remain unchanged. Decision timestamps use the
current clock, including when reviewing the historical seeded scenario.

Decisions and audit entries commit together in SQLite and survive reloads and
server restarts. The Audit page includes them alongside incident/provider history.
There is no temporary-session expiry or eviction. See
[persisted history](INVESTIGATION_HISTORY.md) for workspace access, migration,
backup, and deployment limits.

Reviewer identity remains unverified, and there is no executor. Authenticated
reviewer authorization is required before production execution.

## Verification

```bash
pnpm check:approval
```

This offline assert-based check runs in CI. It covers all risk/approval-state
combinations, incorrectly labeled risky actions, approval/rejection, immutable
proposals, audit metadata, and Relay invariants. `pnpm check:history`
calls the Server Action against SQLite and covers workspace isolation, invalid
inputs, conflicting replay, retained snapshots, and failed writes. Browser checks
exercise Next's transport against the production build.
