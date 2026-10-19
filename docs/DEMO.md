# End-to-End Demo: Checkout Incident #1042

This vertical slice demonstrates the full DevRelay reasoning path using deterministic evidence.

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
