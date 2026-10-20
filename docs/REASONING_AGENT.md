# Reasoning Agent

The Reasoning Agent synthesizes Repository, CI, Runtime Log, and Database evidence into ranked root-cause candidates and a Canonical Reasoning Packet (CRP).

## Inputs

- Repository Agent candidates and evidence.
- CI Agent signals.
- Log Agent runtime-support scores.
- Database Agent infrastructure-support scores.

## Weighting

Current bounded weights:

- Repository: 25%
- CI: 15%
- Runtime logs: 30%
- Database telemetry: 30%

Repository evidence identifies the change candidate. Runtime and database evidence carry the strongest production-causality weight.

## Confidence ceilings

Confidence is capped by evidence-source availability:

- 4 sources: 95%
- 3 sources: 82%
- 2 sources: 65%
- 1 source: 45%
- 0 sources: 25%

Contradicting signals reduce confidence further.

## Promotion rules

A candidate is promoted only if:

1. confidence is at least 55%;
2. at least two evidence sources are available;
3. it is separated from the runner-up by at least five percentage points.

If these conditions are not met, the Reasoning Agent returns an insufficient-evidence result rather than inventing certainty.

## Canonical Reasoning Packet

The CRP includes:

- incident context;
- normalized evidence;
- leading hypothesis;
- bounded confidence;
- supporting evidence IDs;
- contradictions;
- missing evidence;
- recommended actions;
- human-approval requirements;
- audit metadata.

## Recommended actions

High-confidence candidates can trigger a rollback/revert recommendation, but production execution remains approval-gated.

Lower-confidence cases default to evidence collection and controlled validation rather than mutation.

## Epistemic behavior

The Reasoning Agent is deterministic and evidence-bounded. It does not use a language model to invent causal explanations. A future model layer may explain or summarize the packet, but the core confidence and safety logic remains deterministic.
