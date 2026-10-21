# Database Agent

The Database Agent supplies infrastructure evidence without giving DevRelay write access or direct production database credentials.

## Simulated checkout provider

Set `DB_TELEMETRY_URL=simulated://checkout` in `apps/web/.env.local` and restart
the server to explicitly select `SimulatedDatabaseTelemetryProvider`. It uses
the same `inspect({ service, incidentAt })` contract as the HTTP provider and
requires no network, database, or token. Other configured URLs keep using HTTP;
an unset URL remains unconfigured. HTTP failures do not fall back to simulation.

The simulation supports **checkout-service** only. It returns 100/100 active
connections, zero idle connections, 56 waiting requests, and a pool-acquisition
wait event. Query and lock counters are zero, keeping the scenario focused on
connection-pool saturation. Capture time is fixed at incident intake plus seven
minutes forty seconds, matching incident #1042's 20:44:40 UTC fixture when given
its original intake time. Invalid incident timestamps and other services fail.

The existing Database Agent scores this snapshot against repository candidates.
It labels the source `simulated://checkout`, prefixes the summary with “Simulated
checkout evidence,” and sets `metadata.simulated` on its evidence. The provider
and database names are `simulated-postgresql` and `checkout-demo`, and the
investigation screen shows a simulation notice. Replayed freshness and confidence
are not a measurement of current production health.

Use `pnpm check:simulated` for deterministic provider and agent checks.

## Configuration

```env
DB_TELEMETRY_URL=https://db-health.example.com/health
DB_TELEMETRY_TOKEN=
```

DevRelay performs a read-only GET request with:

- `service`
- `incidentAt`

## Expected response

```json
{
  "provider": "postgresql",
  "database": "production",
  "capturedAt": "2026-10-20T07:30:00Z",
  "connections": {
    "active": 100,
    "idle": 4,
    "waiting": 56,
    "max": 100,
    "utilizationPercent": 100
  },
  "queries": {
    "longRunning": 7,
    "longestSeconds": 94
  },
  "locks": {
    "blockedSessions": 3,
    "blockingSessions": 1
  },
  "waits": [
    {
      "type": "Client",
      "event": "ClientRead",
      "count": 12
    }
  ]
}
```

## PostgreSQL source metrics

A thin internal adapter can populate this payload from:

- `pg_stat_activity`;
- `pg_locks`;
- connection-pool telemetry;
- query-duration metrics;
- wait event data.

The adapter should use a read-only database role.

## Reasoning

The Database Agent evaluates:

- connection utilization;
- waiting sessions;
- blocked sessions;
- long-running queries;
- longest query duration;
- dominant wait events.

It then combines that infrastructure score with bounded adjustments from the CI and Log Agents.

### Signals

- **supports** — significant database pressure aligns with the current candidate;
- **contradicts** — database health is normal, weakening a database-pressure explanation;
- **neutral** — telemetry is abnormal but not decisive.

## Safety

DevRelay never mutates the database through this provider. The telemetry endpoint is read-only and credentials remain inside the database environment.
