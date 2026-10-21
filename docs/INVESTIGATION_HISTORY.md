# Persisted investigation and audit history

DevRelay saves incident intake, complete investigation snapshots, provider
results/errors, canonical reasoning packets, and approval decisions in SQLite.
Reloading or restarting the server reopens the saved result without fetching
providers again. The incident queue, dashboard, investigation screen, and Audit
page use the same stored history.

## Run and configure

Use Node.js **22.13+ (22.x) or 24+** and the existing quick start. No new dependency,
external database, credentials, or migration command is needed. SQLite uses
Node's built-in [`node:sqlite`](https://nodejs.org/download/release/v22.13.1/docs/api/sqlite.html).
Node 22 may print an experimental API warning.

By default, the database is `.data/devrelay.sqlite` relative to the web process's
working directory (`apps/web` with `pnpm dev`). To choose a stable location, set an
absolute path in `apps/web/.env.local` or the deployment environment:

```env
DEVRELAY_DB_PATH=/absolute/path/to/persistent-volume/devrelay.sqlite
```

Restart after changing the path. Changing it selects a different database; it
does not migrate an existing file. Database files are private to the OS user
(mode 0600), ignored by Git, and excluded from Next's runtime file tracing.
The database and parent directory must remain writable. An unavailable or corrupt
database fails visibly; there is no in-memory fallback or automatic reset.

The schema initializes on first use. Version 1 stores incidents and ordered
investigation runs. A newer schema version is rejected rather than downgraded.

## Saved snapshots and decisions

- The first visit to an incident saves its investigation. Provider failures and
  insufficient-evidence results are retained too; opening the page does not retry
  them automatically.
- **Run investigation again** collects a new snapshot. Earlier evidence,
  reasoning, and decisions remain available under **Saved investigation history**.
  The new snapshot starts with its own approval requirements.
- History links use `/incidents/<id>?run=<run-id>`. Historical proposals are
  read-only, and the server rejects decisions against superseded runs even if a
  stale browser still displays an approval form.
- Approval/rejection and the corresponding action audit entry commit together.
  Transactions serialize conflicting decisions across processes sharing the file;
  the first final decision wins. Interrupted/failed writes do not report success
  or leave a decision without its audit event.
- Reloads and server restarts preserve final decisions. There is no 30-minute
  expiry, 100-review eviction, or ten-incident cookie cap.
- The Audit page shows incident intake and every saved run, including provider
  outcomes, evidence references, and action decisions. Snapshot timestamps are
  actual save times; the checkout demo retains its fixed scenario/evidence times.

A snapshot is historical evidence. Its original freshness labels and confidence
are retained, not recalculated for today's clock. Run again when fresh evidence
is needed. No action is executed by an approval.

## Browser workspaces and existing data

An HTTP-only, SameSite=Lax cookie holds an unguessable workspace identifier; the
incident data is stored on the server. Production cookies require HTTPS. All
incident, run, audit, and decision queries are scoped to that workspace, including
requests with a known run ID from another browser. This preserves browser
isolation without adding user accounts. The cookie lasts one year; keep it to
retain access. Clearing/losing it creates a new empty workspace and does not
delete the stored records. There is no account recovery or cross-device sync.

Valid incidents from the old `devrelay_incidents_v1` cookie are imported into the
current workspace on access, once per incident ID. Malformed records are ignored,
and imports never overwrite newer server data. Old in-memory approvals had no
durable copy and cannot be recovered. The legacy cookie is left intact.

This remains an unauthenticated MVP: workspace-cookie possession grants access to
that workspace, and `demo-reviewer` is not a verified human identity. A production
action executor still requires authenticated authorization.

## Deployment and backup

Use a persistent local disk/volume. An ephemeral/serverless filesystem loses the
history when its instance is replaced. Processes on the same host may share the
SQLite file; separate hosts do not share local storage. Move to a shared database
before running independent hosts. Full history is currently rendered without
pagination, appropriate for the local MVP.

SQLite uses WAL journaling, a five-second busy timeout, foreign keys, and full
synchronous commits. For a simple consistent backup, stop all DevRelay processes
using the database, then copy its directory (including any `-wal`/`-shm` sidecars)
securely. Restore while the app is stopped. No automatic purge or retention policy
is applied; monitor available disk space.

## Verification

```bash
pnpm check:history
```

The check uses isolated temporary databases. It covers fresh-process recovery,
workspace isolation, legacy import and non-overwrite, more than ten incidents,
provider-error snapshots, stable reopening, preserved older runs, fresh approvals
on rerun, stale/replayed/invalid decisions, conflicting writes from separate Node
processes, interrupted writes, transaction rollback, storage failures/corruption,
private file permissions, and Relay invariants. CI runs it alongside all existing
feature checks. Browser verification covers both incident routes, persisted
approval/rejection, the Audit page, history selection, reload/server restart,
keyboard submission, and narrow layouts.
