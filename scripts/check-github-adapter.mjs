import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const integrations = new URL("../packages/integrations/", import.meta.url);
const require = createRequire(new URL("package.json", integrations));
const output = mkdtempSync(join(tmpdir(), "devrelay-github-"));
const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

try {
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
    "--project", fileURLToPath(new URL("tsconfig.json", integrations)),
    "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", output,
  ], { stdio: "inherit" });
  const adapter = require(join(output, "index.js"));
  const { GitHubRepositoryProvider, GitHubApiError, parseGitHubRepository } = adapter;
  // Load the server agent with the compiled workspace dependency, without Next.js.
  const typescript = require("typescript");
  const agent = { exports: {} };
  const compiled = typescript.transpileModule(readFileSync(new URL("../apps/web/app/lib/repository-agent.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  });
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => name === "@devrelay/integrations" ? adapter : require(name), agent, agent.exports,
  );
  const { runRepositoryAgent } = agent.exports;

  for (const value of ["acme/shop", " acme/shop.git ", "https://github.com/acme/shop.git/", "https://www.github.com/acme/shop/"]) {
    assert.deepEqual(parseGitHubRepository(value), { owner: "acme", repo: "shop", fullName: "acme/shop" });
  }
  for (const value of ["", "shop", "../shop", "acme/..", "acme/shop/extra", "http://github.com/acme/shop", "https://example.com/acme/shop", "https://github.com.evil.test/acme/shop", "https://token@github.com/acme/shop", "https://github.com/acme/shop?x=1", "https://github.com/acme/shop%2Fextra"]) {
    assert.throws(() => parseGitHubRepository(value), undefined, value);
  }

  const incident = {
    id: "test", title: "checkout workers pool timeouts", description: "Checkout workers exhaust the database connection pool",
    service: "checkout-service", repository: "acme/shop", severity: "critical", status: "investigating",
    createdAt: "2026-10-19T20:37:00.000Z", updatedAt: "2026-10-19T20:37:00.000Z",
  };
  const commit = (sha, date) => ({
    sha, html_url: `https://github.com/acme/shop/commit/${sha}`, author: null,
    commit: { message: "checkout-service workers database connection pool", author: { name: "Developer", date: "2026-10-01T00:00:00.000Z" }, committer: date ? { date } : null },
  });
  const pull = (number, mergedAt) => ({
    number, title: "checkout-service workers database connection pool", body: null, state: mergedAt ? "closed" : "open",
    merged_at: mergedAt, updated_at: "2026-10-19T20:30:00.000Z", html_url: `https://github.com/acme/shop/pull/${number}`,
    head: { sha: `head-${number}` }, merge_commit_sha: mergedAt ? `merge-${number}` : null,
  });
  const calls = [];
  let failure;
  let empty = false;
  let oversized = false;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    assert.equal(url.origin, "https://api.github.com");
    assert.ok(!options.method || options.method === "GET", "Evidence requests must be read-only");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal, "Requests need a timeout");
    assert.equal(options.headers.Accept, "application/vnd.github+json");
    if (failure && url.pathname.endsWith(failure.path)) {
      if (failure.error) throw failure.error;
      return new Response(failure.body ?? JSON.stringify({ message: "Test GitHub failure" }), {
        status: failure.status, headers: { "x-ratelimit-remaining": "0" },
      });
    }
    if (url.pathname === "/repos/acme/shop") return Response.json({
      full_name: "acme/shop", default_branch: "main", description: null, private: true, html_url: "https://github.com/acme/shop",
    });
    if (url.pathname.endsWith("/commits")) return Response.json(empty ? [] : [
      commit("before", "2026-10-19T20:18:00.000Z"), commit("after", "2026-10-19T20:38:00.000Z"),
      { ...commit("unknown", null), commit: { message: "checkout-service workers database connection pool", author: null, committer: null } },
    ]);
    if (url.pathname.endsWith("/pulls")) return Response.json(empty ? [] : [
      pull(483, "2026-10-19T20:18:00.000Z"), pull(484, null), pull(485, "2026-10-19T20:38:00.000Z"),
    ]);
    if (/\/pulls\/\d+\/files$/.test(url.pathname)) {
      return Response.json(oversized || url.searchParams.get("page") === "1"
        ? Array.from({ length: 100 }, (_, index) => ({ filename: `src/file-${index}.ts` }))
        : [{ filename: "checkout-service/workers.ts" }]);
    }
    assert.fail(`Unexpected GitHub request: ${url}`);
  };

  const provider = new GitHubRepositoryProvider("test-token");
  const snapshot = await provider.inspect("acme/shop", { since: "2026-10-12T20:37:00.000Z" });
  assert.equal(snapshot.repository.private, true);
  assert.equal(snapshot.commits[0].author, "Developer");
  assert.equal(snapshot.commits[0].date, "2026-10-19T20:18:00.000Z", "Use committer time for change chronology");
  assert.equal(snapshot.pullRequests[0].files.length, 101, "Changed files must include subsequent pages");
  assert.equal(snapshot.pullRequests[0].body, "");
  assert.ok(calls.every(({ options }) => options.headers.Authorization === "Bearer test-token"));
  assert.equal(calls.find(({ url }) => url.pathname.endsWith("/commits")).url.searchParams.get("since"), "2026-10-12T20:37:00.000Z");
  const count = calls.length;
  for (const options of [{ maxCommits: 0 }, { maxPullRequests: -1 }, { maxCommits: NaN }, { maxCommits: 1.5 }, { since: "invalid" }]) {
    await assert.rejects(() => provider.inspect("acme/shop", options));
  }
  assert.equal(calls.length, count, "Invalid options must fail before network access");
  oversized = true;
  await assert.rejects(() => provider.inspect("acme/shop"), /3,000-file limit/);
  oversized = false;

  delete process.env.GITHUB_TOKEN;
  calls.length = 0;
  const result = await runRepositoryAgent(incident);
  assert.equal(result.status, "complete");
  assert.equal(result.inspected.commits, 3);
  assert.ok(result.candidates.find((candidate) => candidate.id === "pr-483").score >= 35);
  for (const id of ["commit-after", "commit-unknown", "pr-484", "pr-485"]) {
    assert.ok(result.candidates.find((candidate) => candidate.id === id).score < 20, `${id} must stay context only`);
    assert.ok(!result.evidence.some((item) => item.id === `github-${id}`));
  }
  for (const evidence of result.evidence) {
    assert.equal(evidence.source, "github:acme/shop");
    assert.equal(evidence.observedAt, result.fetchedAt);
    assert.equal(evidence.freshness, "fresh");
    assert.ok(evidence.uri.startsWith("https://github.com/acme/shop/"));
    assert.ok(evidence.metadata.sha && evidence.metadata.occurredAt);
    assert.equal(evidence.metadata.fetchedAt, result.fetchedAt);
  }
  assert.ok(calls.every(({ options }) => !options.headers.Authorization), "Anonymous requests must omit credentials");
  process.env.GITHUB_TOKEN = "server-test-token";
  calls.length = 0;
  await runRepositoryAgent(incident);
  assert.ok(calls.every(({ options }) => options.headers.Authorization === "Bearer server-test-token"));

  for (const status of [401, 403, 404, 429, 500]) {
    failure = { path: "/repos/acme/shop", status };
    await assert.rejects(() => provider.inspect("acme/shop"), (error) => error instanceof GitHubApiError && error.status === status && error.rateLimitRemaining === "0");
    const failed = await runRepositoryAgent(incident);
    assert.equal(failed.status, "error");
    assert.deepEqual(failed.evidence, []);
    assert.ok(failed.error.includes(String(status)));
  }
  failure = { path: "/pulls/483/files", status: 403, body: "not JSON" };
  const missingFiles = await runRepositoryAgent(incident);
  assert.equal(missingFiles.status, "error", "File request failures must not look like successful empty evidence");
  assert.deepEqual(missingFiles.evidence, []);
  failure = { path: "/repos/acme/shop", error: new DOMException("Test timeout", "TimeoutError") };
  assert.match((await runRepositoryAgent(incident)).error, /timed out/);
  failure = undefined;
  empty = true;
  const emptyResult = await runRepositoryAgent(incident);
  assert.equal(emptyResult.status, "complete");
  assert.deepEqual(emptyResult.evidence, []);
  assert.equal((await runRepositoryAgent({ ...incident, createdAt: "invalid" })).status, "error");
  const beforeInvalid = calls.length;
  assert.equal((await runRepositoryAgent({ ...incident, repository: "" })).status, "error");
  assert.equal((await runRepositoryAgent({ ...incident, repository: "https://evil.test/acme/shop" })).status, "error");
  assert.equal(calls.length, beforeInvalid);
  console.log("PASS: GitHub parsing, auth, pagination, provenance, causal boundaries, empty repositories, API failures, and timeouts");
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
  rmSync(output, { recursive: true, force: true });
}
