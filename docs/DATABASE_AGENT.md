# Database Agent

The Database Agent supplies infrastructure evidence without giving DevRelay write access or direct production database credentials.

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
