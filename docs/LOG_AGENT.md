# Log Agent

The Log Agent gives DevRelay its first real production-runtime evidence source.

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
