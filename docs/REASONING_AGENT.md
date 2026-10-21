# Reasoning Agent

The Reasoning Agent synthesizes Repository, CI, Runtime Log, and Database evidence into ranked root-cause candidates and a Canonical Reasoning Packet (CRP).

## Inputs

- Repository Agent candidates and evidence.
- CI Agent signals.
- Log Agent runtime-support scores.
- Database Agent infrastructure-support scores.

Only completed agent results with evidence of the correct source kind are
accepted. Duplicate evidence IDs are consolidated. A repository candidate needs
its own repository evidence, and each additional finding needs its matching
evidence ID before it can influence the score. Failed, unconfigured, or empty
sources cannot contribute leftover findings or confidence.

## Weighting

Current bounded weights:

- Repository: 25%
- CI: 15%
- Runtime logs: 30%
- Database telemetry: 30%

Repository evidence identifies the change candidate. Runtime and database evidence carry the strongest production-causality weight.

Unavailable signals contribute zero. CI support contributes its full weight;
neutral CI contributes half. Runtime and database scores are bounded to 0–100,
with neutral contributions capped at half their weight. Contradicting signals
contribute zero and each subtracts eight percentage points. Invalid numerical
scores contribute zero.

## Confidence ceilings

Confidence is capped by the number of completed sources with actual evidence:

- 4 sources: 95%
- 3 sources: 82%
- 2 sources: 65%
- 1 source: 45%
- 0 sources: 25%

Contradicting signals reduce confidence further.

The canonical packet's freshness rule also applies: each distinct stale or
unknown evidence object reduces the ceiling by five percentage points, with a
floor of zero. The lower of the source and freshness ceilings bounds candidate
scores **before** ranking, promotion, confidence bands, and action selection.
The winning candidate and canonical hypothesis therefore use the same bounded
confidence. Missing sources add no confidence.

## Promotion rules

A candidate is promoted only if:

1. confidence is at least 55%;
2. at least two source-specific evidence IDs support it, including its repository
   evidence and an explicitly supporting CI, log, or database finding;
3. it is separated from the runner-up by at least five percentage points.

If these conditions are not met, the Reasoning Agent returns an insufficient-evidence result rather than inventing certainty.

Neutral evidence remains in the packet as context but is not cited as support.
Contradicting evidence is tracked separately and its IDs are preserved in audit
metadata. A completed provider with only neutral signals cannot corroborate a
root cause. Repository plus CI alone cannot reach 55% with the current weights.
Abstention leaves the hypothesis evidence IDs empty while retaining tentative
candidate scores and reasons for inspection. With no eligible candidate,
hypothesis confidence is zero.

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

Missing evidence includes unavailable sources, candidate findings without
provenance, inconclusive signals, close competitors, and freshness warnings.
The reasoning audit entry records the decision, leading candidate, confidence
ceiling, candidate separation, accepted sources, and contradictory evidence IDs.

## Recommended actions

High-confidence candidates can trigger a rollback/revert recommendation, but production execution remains approval-gated.

Lower-confidence cases default to evidence collection and controlled validation rather than mutation.

Rollback preparation is recommended only for a promoted candidate with at least
75% bounded confidence, and remains medium risk with human approval required.
An abstained result recommends collecting evidence only. The agent executes no
actions.

## Simulated evidence

When accepted evidence is marked `metadata.simulated`, the hypothesis explicitly
describes a simulated scenario. The packet requests live verification before a
production diagnosis and records simulation in the audit metadata. Confidence
describes the replay, not production health. The investigation screen retains
the simulation notice introduced with the providers.

## Epistemic behavior

The Reasoning Agent is deterministic and evidence-bounded. It does not use a language model to invent causal explanations. A future model layer may explain or summarize the packet, but the core confidence and safety logic remains deterministic.

Scoring and decisions repeat for identical inputs. Packet generation and audit
timestamps describe when synthesis ran.

## Verification

```bash
pnpm check:reasoning
```

The offline check covers provenance, missing and failed sources, neutral and
contradicting signals, stale/unknown evidence, ties, input isolation, approval
gates, simulated-provider integration, Borderless Relay invariants, and the
existing eight labeled benchmarks. CI runs it alongside the earlier feature
checks. No credentials or model API are required.
