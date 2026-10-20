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
- evidence count;
- missing-evidence count;
- contradiction count;
- approval requirement;
- first recommended action.

It is suitable for constrained channels such as SMS, low-data mobile clients, or offline incident bundles.

## Translation strategy

The current implementation is deterministic. Kiswahili framing is localized, while the canonical diagnosis itself is preserved exactly as an invariant.

A future model-assisted translator may rewrite the diagnosis text for fluency, but it must emit structured metadata and pass the same invariant verifier before its output is accepted.
