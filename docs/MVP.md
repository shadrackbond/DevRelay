# Hackathon MVP

## Demo scenario

**Incident:** Production checkout failures rise from 0.2% to 8.7%.

DevRelay should:

1. receive the incident;
2. inspect a recent GitHub change;
3. inspect runtime logs;
4. inspect database connection health;
5. correlate the signals;
6. identify connection-pool saturation as the likely root cause;
7. produce a Canonical Reasoning Packet;
8. render the same diagnosis in technical English, Kiswahili, and plain language;
9. lower confidence if evidence is stale/offline;
10. propose a safe remediation;
11. require human approval before any mutation.

## Definition of done

- [ ] Dashboard is usable and visually consistent.
- [ ] Incident creation starts an investigation.
- [ ] At least three evidence providers participate.
- [ ] Every evidence object has source + timestamp + freshness.
- [ ] Root cause references evidence IDs.
- [ ] Confidence is bounded by evidence freshness.
- [ ] Translation/simplification does not change the root cause.
- [ ] Proposed mutations are gated by approval.
- [ ] An audit trail explains what each agent did.
- [ ] Demo can run deterministically with seeded data.

## Stretch scope

- Real GitHub OAuth/App integration.
- GitHub Actions workflow ingestion.
- Datadog / Sentry / Grafana adapters.
- PostgreSQL telemetry.
- WhatsApp/Telegram/Slack channels.
- Voice input/output.
- Local/offline inference.
- Automated patch generation and sandbox verification.
