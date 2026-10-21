# Log Agent

The Log Agent gives DevRelay its first real production-runtime evidence source.

## Simulated checkout provider

Set `LOG_SOURCE_URL=simulated://checkout` in `apps/web/.env.local` and restart
the server to explicitly select `SimulatedRuntimeLogProvider`. It uses the same
`query({ service, from, to, limit })` contract as the HTTP provider, makes no
network requests, and requires no token. Other configured URLs keep using HTTP;
an unset URL remains unconfigured. HTTP failures do not select simulated data.

The simulation supports **checkout-service** only. It produces 1,248
`DB_CONNECTION_ACQUIRE_TIMEOUT` entries across ten minutes, with unique stable
trace IDs. Timestamps are anchored to incident intake, and collection is fixed
at intake plus eight minutes. For incident #1042's intake time, this matches the
seed's log window ending at 2026-10-19 20:44:20 UTC. Query time boundaries are
inclusive, entries are chronological, and the result limit is capped at 2,000.
Invalid time ranges, limits, timestamps, or services produce errors.

The agent requests the full seeded burst, clusters it, and scores it against the
repository candidates using its existing logic. Simulation does not manufacture
repository candidates. It labels the source `simulated://checkout`, prefixes the
summary with “Simulated checkout evidence,” and sets `metadata.simulated` on its
evidence. The investigation screen also shows a simulation notice. Freshness
describes the replayed scenario, not current production health.

Use `pnpm check:simulated` for deterministic provider and agent checks.

## Provider contract

Set:

```env
LOG_SOURCE_URL=https://logs.example.com/query
LOG_SOURCE_TOKEN=
```

DevRelay sends a read-only HTTP GET request with:

- `service`
- `from`
- `to`
- `limit`

The endpoint may return either:

```json
[
  {
    "timestamp": "2026-10-20T07:00:00Z",
    "level": "error",
    "message": "DB_CONNECTION_ACQUIRE_TIMEOUT",
    "service": "checkout-service",
    "traceId": "abc123"
  }
]
```

or:

```json
{
  "entries": []
}
```

`logs` is also accepted as an alternative key.

## Normalized fields

- timestamp
- level
- message
- service
- traceId
- metadata

## Reasoning

The Log Agent:

1. clusters repeated messages into normalized signatures;
2. measures frequency / burst intensity;
3. compares first-seen time against suspicious repository changes;
4. compares log language against incident, service, PR, and changed-file terms;
5. weighs runtime severity;
6. incorporates CI evidence as a small supporting/contradicting adjustment;
7. emits normalized DevRelay Evidence.

## Signal meanings

- **supports** — runtime timing and semantics materially align with a repository candidate;
- **contradicts** — relevant runtime failures clearly predate the candidate;
- **neutral** — runtime evidence is weak or ambiguous.

## Safety

The provider is read-only. `LOG_SOURCE_TOKEN` is used server-side only.

## Vendor adapters

This HTTP contract can sit in front of:

- Grafana Loki
- Datadog
- Better Stack
- Elastic / OpenSearch
- Vercel log drains
- CloudWatch
- custom internal logging services

DevRelay does not require the core agent to know vendor-specific query languages.
