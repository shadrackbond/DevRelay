# CI Agent

The CI Agent connects DevRelay to GitHub Actions and correlates workflow evidence with suspicious repository changes.

## Data collected

- workflow runs;
- exact `head_sha`;
- event type;
- status and conclusion;
- jobs;
- failed jobs;
- failed steps;
- detected validation categories.

## Correlation

Repository Agent candidates expose a commit SHA. The CI Agent matches GitHub Actions runs using the exact SHA.

Signals are classified as:

- **supports** — one or more matched workflow runs failed;
- **contradicts** — matched runs passed with broad validation coverage;
- **neutral** — no run matched, the run is incomplete, or CI passed but important validation categories appear absent.

## Validation coverage heuristic

DevRelay currently detects:

- build;
- unit tests;
- integration/E2E tests;
- linting;
- type checking;
- security checks;
- performance/load testing.

A green workflow does not automatically clear a suspicious change. If integration or performance validation is absent, the result remains neutral rather than contradictory.

## Epistemic boundary

Repository + CI evidence is still insufficient for a production root-cause claim. Runtime logs, metrics, database telemetry, or another production signal must corroborate the hypothesis before DevRelay promotes it.
