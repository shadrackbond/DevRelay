# DevRelay

**Borderless AI incident response for modern software teams.**

DevRelay is an agentic engineering platform that investigates incidents across repositories, CI/CD, runtime logs, databases, monitoring systems, and documentation while preserving one consistent, auditable diagnosis across languages, literacy levels, channels, and connectivity conditions.

> Hackathon track: Omega AI Agents — Agent Without Borders

## Why DevRelay

Engineering incidents rarely live in one tool. A production failure may require correlating a pull request, CI run, runtime logs, database telemetry, monitoring alerts, and documentation.

DevRelay coordinates specialized agents across these boundaries and produces a single **Canonical Reasoning Packet (CRP)** containing evidence, provenance, confidence, contradictions, missing information, recommended actions, and audit history.

The CRP can then be rendered for different users and access conditions without silently changing the underlying diagnosis.

## Repository layout

```text
apps/
  web/                  Next.js command center
packages/
  core/                 incidents, evidence, agents, orchestration, CRP
  integrations/         provider contracts for GitHub, logs, CI, DB, monitoring
docs/
  ARCHITECTURE.md
  MVP.md
```

## Core principles

1. **Evidence before action** — every diagnosis references traceable evidence.
2. **Read-first autonomy** — investigation is autonomous; mutations are policy-gated.
3. **Human approval for risk** — material production changes require approval.
4. **Borderless invariants** — language or presentation changes cannot alter root cause, confidence ceiling, provenance, or approval requirements.
5. **Connectivity-aware reasoning** — stale/offline evidence reduces confidence explicitly rather than being hidden.

## Quick start

```bash
corepack enable
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open http://localhost:3000.

Next.js loads environment files from `apps/web`, so put local credentials in
`apps/web/.env.local`, not the repository root. Restart the web server after
changing these values. For hosted deployments, set them in the web service's
server environment.

### Connecting the investigation agents

- **Repository and CI:** set `GITHUB_TOKEN`. Both agents use this token.
  Anonymous requests can hit GitHub's shared IP rate limit, including for public
  repositories. The token must have read access to the repository and its Actions
  data.
- **Runtime logs:** set `LOG_SOURCE_URL` to a real read-only JSON log endpoint.
  The agent sends `service`, `from`, `to`, and `limit` query parameters and accepts
  an array of entries or an object with an `entries` or `logs` array. Each entry
  needs a `timestamp` and `message`; `level`, `service`, and `traceId` are optional.
  Set `LOG_SOURCE_TOKEN` if the endpoint requires bearer authentication.
- **Database:** set `DB_TELEMETRY_URL` to a real read-only JSON database telemetry
  endpoint, with `DB_TELEMETRY_TOKEN` for optional bearer authentication. The agent
  sends `service` and `incidentAt` query parameters. The response shape is defined
  by `DatabaseTelemetrySnapshot` in
  [database-telemetry.ts](packages/integrations/src/database-telemetry.ts).
  `DATABASE_URL` does not connect this agent.

The example endpoint URLs displayed in the UI are placeholders. Without actual
log and database adapters or an explicitly selected simulation, those agents
report that they are not connected.

### Simulated checkout providers

To run new checkout investigations without live log or database endpoints, set
these values in `apps/web/.env.local` and restart the web server:

```env
LOG_SOURCE_URL=simulated://checkout
DB_TELEMETRY_URL=simulated://checkout
```

Create an investigation for **checkout-service** and attach a GitHub repository.
The providers replay 1,248 connection-acquisition timeouts and a saturated
100-connection pool with 56 waiting requests, anchored to the incident timestamp.
Both sources are labeled simulated in the investigation. Repository and CI
evidence still use GitHub; the fixed demo at `/incidents/1042` remains entirely
offline. Leaving a URL unset keeps that agent unconfigured, and HTTP failures
never fall back to simulation.

Run `pnpm check:simulated` to verify the providers and their agent integration
without network access. See [Log Agent](docs/LOG_AGENT.md) and
[Database Agent](docs/DATABASE_AGENT.md) for provider details.

## Foundation status

The current foundation includes:

- monorepo workspace;
- Next.js command-center shell;
- typed incident/evidence/action contracts;
- pluggable agent interface;
- investigation orchestrator;
- Canonical Reasoning Packet builder;
- confidence ceiling based on evidence freshness;
- borderless reasoning invariant checks;
- external integration contracts;
- CI workflow;
- architecture and hackathon-MVP documentation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MVP.md](docs/MVP.md).

## Next implementation slice

1. **Complete:** Seed the deterministic checkout-failure demo. [Run and verify it](docs/DEMO.md).
2. **Complete:** Implement GitHub evidence adapter. [Configure and verify it](docs/REPOSITORY_AGENT.md).
3. **Complete:** Add simulated log and database providers. See the simulation setup above.
4. **Complete:** Add synthesis/reasoning agent. [Rules and verification](docs/REASONING_AGENT.md).
5. Build Incident Investigation and Borderless Relay screens.
6. Add human-approval action gate.
7. Persist investigation/audit history.
8. Replace simulated providers with real integrations incrementally.
