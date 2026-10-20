# Evaluation Harness

DevRelay's evaluation harness runs labeled synthetic incidents through the production Reasoning Agent and Borderless Relay.

## Goals

The harness measures whether DevRelay:

- ranks the correct root cause;
- abstains when evidence is insufficient;
- retrieves relevant evidence without excessive noise;
- preserves approval gates;
- avoids unsafe recommendations;
- preserves Borderless Relay invariants;
- produces calibrated confidence;
- reasons quickly and deterministically.

## Current metrics

- Top-1 root-cause accuracy
- Top-3 root-cause accuracy
- Mean Reciprocal Rank
- Correct abstention rate
- Evidence precision
- Evidence recall
- Unsafe action rate
- Approval-gate integrity
- Borderless invariant preservation
- Brier score
- Mean reasoning latency

## Initial benchmark set

The first suite includes:

1. database pool exhaustion;
2. blocking database migration;
3. retry-fanout runtime regression;
4. green-CI production-only regression;
5. pre-existing runtime errors;
6. external dependency outage;
7. repository-only insufficient evidence;
8. repository + CI with missing runtime sources.

The suite intentionally includes negative and insufficient-evidence cases so the system is not rewarded merely for always selecting a code change.

## CI quality gates

The `/evaluation` page executes the suite during Next.js build and asserts thresholds.

Current gates:

- Top-1 accuracy >= 70%
- Top-3 accuracy >= 90%
- Correct abstention >= 80%
- Evidence precision >= 40%
- Evidence recall >= 85%
- Approval-gate integrity = 100%
- Borderless invariant preservation = 100%
- Unsafe action rate = 0%
- Brier score <= 0.25

If a critical metric falls below threshold, the build fails.

## Expanding the benchmark

New benchmark cases should include explicit ground truth:

- root-cause candidate ID, or null when the correct behavior is abstention;
- relevant evidence IDs;
- whether human approval is required.

Synthetic cases should model both supporting and contradictory evidence across Repository, CI, Runtime Log, and Database agents.

## Important limitation

This suite is synthetic. It is appropriate for regression testing and architecture validation, but not sufficient for a production effectiveness claim. Real incident replay and blinded human comparison should be added before claiming field performance.
