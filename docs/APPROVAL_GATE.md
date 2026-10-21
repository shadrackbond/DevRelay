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
5. Reload for a new review to try the other outcome. A decision is final within
   one review; there is no reset that changes a rejected proposal into approval.

Approval satisfies the proposal's approval check; rejection does not. Neither
outcome executes an action. Missing-evidence investigations only recommend
collecting evidence and offer no unnecessary approval controls.

## Server boundary and limits

Each page receives a random, unguessable review capability. The server owns a
cloned packet snapshot and accepts only that capability, an action ID belonging
to the snapshot, and an `approved`/`rejected` decision. The browser cannot submit a
replacement packet, description, risk, or prior decision. Replay and conflicting
submissions use the current server state and cannot change a final decision.
The capability identifies the exact page proposal, not the latest state of a
production incident. A new review never inherits another snapshot's approval.

The server appends the action ID, description, risk, decision, timestamp, and
`demo-reviewer` actor to the returned packet's audit. The response, evidence audit,
and Relay render that packet together. Diagnosis, evidence, confidence, and the
original packet generation time remain unchanged. Decision timestamps use the
current clock, including when reviewing the historical seeded scenario.

This is an unauthenticated, single-process demo: possession of the capability
permits a demo decision, not production authorization. Reviewer identity is not
verified, and there is no executor. Snapshots last 30 minutes, are lost on server
restart, and are limited to 100 per process (oldest evicted first). Missing,
expired, or evicted snapshots fail closed with reload guidance. Multiple server
instances do not share reviews. Reloading creates a new review; the standalone
Audit page continues to show the seed rather than these temporary decisions.

Feature seven will address durable investigation/audit history. Authenticated
reviewer authorization and a shared durable proposal store must precede any
production action executor. No credentials, database, or dependency were added.

## Verification

```bash
pnpm check:approval
```

This offline assert-based check runs in CI. It covers all risk/approval-state
combinations, incorrectly labeled risky actions, approval/rejection, immutable
source packets, audit metadata, Relay invariants, invalid/foreign inputs,
conflicting replay, snapshot isolation, expiry, and capacity eviction. It also
calls the Server Action against the real store implementation without Next's
transport. Browser checks exercise that transport against the production build.
