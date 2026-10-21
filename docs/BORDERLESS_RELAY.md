# Borderless Relay

Borderless Relay renders one Canonical Reasoning Packet (CRP) into multiple communication modes without allowing the underlying reasoning state to change.

## Current modes

- Technical English
- Kiswahili
- Plain English
- Low-bandwidth compact text

## Invariants

Every rendered view must preserve:

- canonical diagnosis;
- confidence;
- confidence ceiling;
- supporting evidence IDs;
- contradictions;
- missing-evidence flags;
- recommended action identities;
- action risk;
- approval semantics;
- safety gate.

Each view also carries a deterministic invariant fingerprint derived from those fields.

The fingerprint includes action descriptions as well as their IDs, risks, and
approval states. Low-bandwidth message text is checked against the packet too;
changing or omitting its contents fails verification.

## Investigation screens

Both `/incidents/1042` and created investigations have section links for Diagnosis,
Evidence, Response, and Borderless Relay. The shared evidence ledger shows accepted
evidence with its reference ID, source, observation time in UTC, freshness, and
support/context/contradiction role. Simulated evidence is labeled explicitly.
HTTP sources can be opened; demo-only protocol references are displayed as text.
An expandable audit trail links collection and reasoning events to the same
evidence cards. Empty investigations explain why no evidence has been accepted.

Candidate and Relay evidence references jump to the corresponding provenance
card. Provider failures and insufficient-evidence states remain visible rather
than being replaced with a demo diagnosis.

## Choosing and sharing a format

The Relay screen shows one format at a time. Native radio controls support mouse,
touch, Tab, and arrow-key selection. The preview changes while a separate context
panel keeps confidence, ceiling, supporting references, contradictions, gaps, and
human-approval requirements visible.

Copy message and Download text share the chosen presentation plus the full
canonical text summary. The low-bandwidth option shares that summary directly.
Every export includes all recommended actions with risk and approval state,
supporting evidence IDs, and the actual warning text. Downloads are `.txt` files
generated locally, with no extra provider requests or external sharing service.
If clipboard access is unavailable, the screen offers the download fallback.
The initial preview, evidence ledger, and audit disclosure are server rendered;
JavaScript enables format switching, copying, and local text downloads.

If a renderer changes any invariant field, rendering throws an invariant violation instead of showing the unsafe output.

## Design principle

Reason once, render many.

The Reasoning Agent owns diagnosis and confidence. Borderless Relay only changes presentation.

This avoids a dangerous architecture where each language or channel independently asks a model to reinterpret the incident.

## Low-bandwidth mode

Low-bandwidth rendering includes:

- incident ID;
- canonical cause;
- confidence;
- confidence ceiling;
- supporting evidence IDs;
- full missing-evidence details;
- full contradictions;
- approval requirement;
- every recommended action, its ID, risk, and approval state.

It is suitable for constrained channels such as SMS, low-data mobile clients, or offline incident bundles.

## Translation strategy

The current implementation is deterministic. Kiswahili framing is localized, while the canonical diagnosis itself is preserved exactly as an invariant.

The Kiswahili preview explicitly states that the diagnosis and evidence remain in
English. It is localized framing, not a complete translation service.

A future model-assisted translator may rewrite the diagnosis text for fluency, but it must emit structured metadata and pass the same invariant verifier before its output is accepted.

## Verification

`pnpm check:demo` verifies complete compact exports, all four Relay invariants,
action-description fingerprint changes, empty exports, and rejection of tampered
compact text. `pnpm check:reasoning` verifies Relay invariants across the eight
labeled reasoning benchmarks. Both checks run in CI.

Browser verification covers desktop/mobile overflow, native format keyboard
selection, unchanged diagnosis and safety fields across formats, copy feedback,
download content, evidence navigation, audit disclosure, and provider-error
states. The existing optional `scripts/check-ui.mjs` requires `agent-browser`;
browser checks can also be performed directly against the local app.
