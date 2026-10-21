# End-to-End Demo: Checkout Incident #1042

This vertical slice demonstrates the full DevRelay reasoning path using deterministic evidence.

## Run the seeded demo

After the README quick start, open [the checkout demo](http://localhost:3000/incidents/1042).
The dashboard, incident queue, and audit screen also link to or use this seed.
No credentials, external services, or database setup are required for the demo.
The seed lives in `packages/core/src/demo/checkout-investigation.ts` and is
available automatically; there is no database seed command to run.

Verify the seed without starting the web server:

```bash
pnpm check:demo
```

This checks repeatable output, all four evidence sources, diagnosis provenance,
audit chronology, and the required mitigation approval. It rejects network fetches
and verifies that modifying a result cannot affect the next run. CI runs this
check too.

Every run uses the fixed scenario time **2026-10-19 20:45 UTC** and produces
the same evidence, diagnosis, confidence, actions, and audit trail. Freshness
labels describe that scenario time, not the current wall clock. Approval in the
demo is a local UI decision and does not execute a production change.

## Incident

Checkout failures rise from **0.2% to 8.7%**.

## Evidence providers

1. **Repository Agent**
   - PR #483 changed `CHECKOUT_WORKERS` from 20 to 80.
2. **CI Agent**
   - Build #1142 passed.
   - No production-scale concurrency test exists.
3. **Log Agent**
   - 1,248 `DB_CONNECTION_ACQUIRE_TIMEOUT` errors in 10 minutes.
4. **Database Agent**
   - 100/100 active connections.
   - 56 requests waiting.

## Correlated diagnosis

> PR #483 increased checkout worker concurrency, exhausting the production database connection pool and causing acquisition timeouts.

Confidence: **91%**.

The green CI run is preserved as a contradiction rather than ignored. DevRelay explains that CI lacked the concurrency coverage needed to expose this failure mode.

## Recommended mitigation

1. Reduce `CHECKOUT_WORKERS` from 80 to 30.
2. Redeploy.
3. Monitor pool saturation and checkout errors for 30 minutes.
4. Add a concurrency regression test.

The production configuration change is marked **medium risk** and is blocked behind a human approval gate.

## Borderless requirement

The UI renders the same Canonical Reasoning Packet as:

- technical English;
- Kiswahili;
- plain language;
- compact low-bandwidth text.

The underlying evidence IDs, root-cause semantics, confidence, and approval requirement remain unchanged.
