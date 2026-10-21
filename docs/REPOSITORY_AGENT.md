# GitHub evidence adapter

The Repository Agent uses `GitHubRepositoryProvider` from
`packages/integrations/src/github.ts` to inspect repository metadata, recent
default-branch commits, pull requests, and changed file names through read-only
GitHub REST requests. No dependency or database setup is needed beyond the
README quick start.

## Run an investigation

1. Set `GITHUB_TOKEN` in `apps/web/.env.local` and restart the web server.
   The token needs read access to the chosen repository. Public repositories
   also work anonymously, subject to GitHub's rate limits. The existing CI Agent
   uses the same token and needs Actions read access.
2. Open `/investigations/new`, describe the incident and service, and supply
   `owner/repo` or `https://github.com/owner/repo` (optionally ending in `.git`
   or `/`). URLs with credentials, query strings, extra path segments, or a
   different host are rejected before any API request.
3. Submit the incident. Its investigation screen shows ranked repository
   candidates, their correlation reasons, changed files, and GitHub links.
   No production changes are executed.

The deterministic checkout demo at `/incidents/1042` continues to use its fixed
fixtures and requires no GitHub connection.

## Evidence and limits

The agent inspects up to 12 commits from the seven days before incident intake
through the current time and the eight most recently updated pull requests.
Candidates are ranked by incident terminology, service relevance, and timing.
Commit timing uses the committer timestamp, falling back to author time when
unavailable. Neither a commit nor a merged pull request proves deployment.

Unmerged pull requests, changes after incident intake, and changes with unknown
timestamps are retained as context with scores below 20. They cannot enter the
repository evidence used by synthesis. Other candidates scoring at least 20
produce `Evidence` objects with stable IDs, repository source, GitHub URL, SHA,
change timestamp, collection timestamp, correlation reasons, and file names.
`observedAt` is the collection time; `metadata.occurredAt` preserves change time.
Freshness describes the successful collection, not the age of the code change.

Changed files are fetched in pages of 100. Reaching GitHub's 3,000-file ceiling
reports an error rather than claiming complete file evidence. Candidate summaries
retain the first 12 file names after scoring against the fetched file list.
The provider's configurable result limits are capped at 30 commits and 20 PRs.
This is a bounded incident snapshot, not a complete repository history.

Every request has a ten-second timeout. Authentication failures, missing
repositories, rate limits, network failures, and file-fetch failures produce an
explicit Repository Agent error with no fabricated evidence. Retry by reloading
the investigation after correcting access or waiting for the rate limit reset.

API references: [GitHub pull requests and file pagination](https://docs.github.com/en/rest/pulls/pulls),
[commit timestamps](https://docs.github.com/en/rest/commits/commits), and
[rate-limit responses](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Verify without credentials

```bash
pnpm check:github
```

This uses mocked fetch responses to exercise parsing, authenticated and anonymous
requests, multi-page files, provenance, context-only candidates, empty results,
invalid inputs, API errors, and timeouts. No live GitHub requests are made. CI
runs the same check.
