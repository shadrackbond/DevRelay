import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const integrations = new URL("../packages/integrations/", import.meta.url);
const require = createRequire(new URL("package.json", integrations));
const output = mkdtempSync(join(tmpdir(), "devrelay-simulation-"));
const originalFetch = globalThis.fetch;
const envKeys = ["LOG_SOURCE_URL", "DB_TELEMETRY_URL", "LOG_SOURCE_TOKEN", "DB_TELEMETRY_TOKEN"];
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

try {
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
    "--project", fileURLToPath(new URL("tsconfig.json", integrations)),
    "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", output,
  ], { stdio: "inherit" });
  const adapter = require(join(output, "index.js"));
  const { SimulatedRuntimeLogProvider, SimulatedDatabaseTelemetryProvider, SIMULATED_CHECKOUT_SOURCE } = adapter;
  const typescript = require("typescript");
  function loadAgent(file) {
    const agent = { exports: {} };
    const compiled = typescript.transpileModule(readFileSync(new URL(`../apps/web/app/lib/${file}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
    });
    new Function("require", "module", "exports", compiled.outputText)(
      (name) => name === "@devrelay/integrations" ? adapter : require(name), agent, agent.exports,
    );
    return agent.exports;
  }
  const { runLogAgent } = loadAgent("log-agent");
  const { runDatabaseAgent } = loadAgent("database-agent");
  let requests = 0;
  globalThis.fetch = () => { requests += 1; throw new Error("Simulation must not use the network"); };
  const incident = {
    id: "test", title: "Production checkout failing", description: "Checkout workers exhaust the database connection pool",
    service: "checkout-service", repository: "acme/shop", severity: "critical", status: "investigating",
    createdAt: "2026-10-19T20:37:00.000Z", updatedAt: "2026-10-19T20:37:00.000Z",
  };
  const input = { service: incident.service, from: "2026-10-19T20:30:00.000Z", to: "2026-10-19T20:50:00.000Z", limit: 2000 };
  const logsProvider = new SimulatedRuntimeLogProvider(incident.createdAt);
  const databaseProvider = new SimulatedDatabaseTelemetryProvider();
  const dbInput = { service: incident.service, incidentAt: incident.createdAt };
  const logSnapshot = await logsProvider.query(input);
  const dbSnapshot = await databaseProvider.inspect(dbInput);
  assert.equal(logSnapshot.entries.length, 1248);
  assert.equal(logSnapshot.source, SIMULATED_CHECKOUT_SOURCE);
  assert.equal(logSnapshot.entries[0].timestamp, "2026-10-19T20:34:20.000Z");
  assert.equal(logSnapshot.entries.at(-1).timestamp, "2026-10-19T20:44:20.000Z");
  assert.equal(logSnapshot.fetchedAt, "2026-10-19T20:45:00.000Z");
  assert.ok(logSnapshot.entries.every((entry) => entry.metadata.simulated && entry.message.includes("DB_CONNECTION_ACQUIRE_TIMEOUT")));
  assert.equal(new Set(logSnapshot.entries.map((entry) => entry.traceId)).size, 1248);
  assert.deepEqual(dbSnapshot.connections, { active: 100, idle: 0, waiting: 56, max: 100, utilizationPercent: 100 });
  assert.equal(dbSnapshot.capturedAt, "2026-10-19T20:44:40.000Z");
  assert.equal(dbSnapshot.metadata.simulated, true);
  assert.deepEqual(await logsProvider.query(input), logSnapshot);
  assert.deepEqual(await databaseProvider.inspect(dbInput), dbSnapshot);
  const expectedLogs = structuredClone(logSnapshot);
  const expectedDatabase = structuredClone(dbSnapshot);
  logSnapshot.entries[0].message = "Changed by a caller";
  dbSnapshot.connections.active = 0;
  assert.deepEqual(await logsProvider.query(input), expectedLogs);
  assert.deepEqual(await databaseProvider.inspect(dbInput), expectedDatabase);
  assert.equal((await logsProvider.query({ ...input, limit: 5 })).entries.length, 5);
  assert.equal((await logsProvider.query({ ...input, limit: 5000 })).entries.length, 1248);
  assert.deepEqual((await logsProvider.query({ ...input, from: input.to, to: input.to })).entries, []);
  const filtered = await logsProvider.query({ ...input, from: "2026-10-19T20:40:00.000Z", to: "2026-10-19T20:41:00.000Z" });
  assert.ok(filtered.entries.length > 0 && filtered.entries.every((entry) => entry.timestamp >= "2026-10-19T20:40:00.000Z" && entry.timestamp <= "2026-10-19T20:41:00.000Z"));
  for (const invalid of [{ from: "invalid" }, { to: "invalid" }, { from: input.to, to: input.from }, { limit: 0 }, { limit: 1.5 }, { limit: NaN }, { service: "billing-service" }]) {
    await assert.rejects(() => logsProvider.query({ ...input, ...invalid }));
  }
  await assert.rejects(() => new SimulatedRuntimeLogProvider("invalid").query(input));
  await assert.rejects(() => databaseProvider.inspect({ ...dbInput, incidentAt: "invalid" }));
  await assert.rejects(() => databaseProvider.inspect({ ...dbInput, service: "billing-service" }));
  const shifted = await new SimulatedRuntimeLogProvider("2026-10-20T20:37:00.000Z").query({ ...input, from: "2026-10-20T20:30:00.000Z", to: "2026-10-20T20:50:00.000Z" });
  assert.equal(shifted.entries.length, 1248);
  assert.equal(shifted.fetchedAt, "2026-10-20T20:45:00.000Z");

  const candidate = { id: "pr-483", type: "pull-request", title: "Increase checkout workers", url: "https://github.com/acme/shop/pull/483", sha: "6c81fe2", occurredAt: "2026-10-19T20:18:00.000Z", score: 91, reasons: [], files: ["checkout-service/workers.ts"] };
  const repository = { status: "complete", repository: "acme/shop", summary: "Fixture", candidates: [candidate], evidence: [], inspected: { commits: 0, pullRequests: 1 } };
  const ci = { status: "error", findings: [], evidence: [] };
  delete process.env.LOG_SOURCE_URL;
  delete process.env.DB_TELEMETRY_URL;
  const unconfiguredLogs = await runLogAgent(incident, repository, ci);
  assert.equal(unconfiguredLogs.status, "unconfigured");
  assert.equal((await runDatabaseAgent(incident, repository, ci, unconfiguredLogs)).status, "unconfigured");
  process.env.LOG_SOURCE_URL = SIMULATED_CHECKOUT_SOURCE;
  process.env.DB_TELEMETRY_URL = SIMULATED_CHECKOUT_SOURCE;
  process.env.LOG_SOURCE_TOKEN = "unused-in-simulation";
  process.env.DB_TELEMETRY_TOKEN = "unused-in-simulation";
  const logs = await runLogAgent(incident, repository, ci);
  const database = await runDatabaseAgent(incident, repository, ci, logs);
  assert.equal(logs.status, "complete");
  assert.equal(logs.entriesInspected, 1248);
  assert.equal(logs.signatures.length, 1);
  assert.equal(logs.findings[0].signal, "supports");
  assert.equal(database.status, "complete");
  assert.equal(database.snapshot.connections.waiting, 56);
  assert.equal(database.findings[0].signal, "supports");
  for (const result of [logs, database]) {
    assert.match(result.summary, /^Simulated checkout evidence/);
    assert.equal(result.source, SIMULATED_CHECKOUT_SOURCE);
    assert.equal(result.evidence.length, 1);
    assert.equal(result.evidence[0].metadata.simulated, true);
  }
  assert.deepEqual(await runLogAgent(incident, repository, ci), logs);
  assert.deepEqual(await runDatabaseAgent(incident, repository, ci, logs), database);
  assert.equal((await runLogAgent({ ...incident, createdAt: "invalid" }, repository, ci)).status, "error");
  assert.equal((await runDatabaseAgent({ ...incident, service: "billing-service" }, repository, ci, logs)).status, "error");
  assert.equal(requests, 0, "Simulation and unconfigured agents must not make network requests");

  process.env.LOG_SOURCE_URL = "https://logs.test/query";
  process.env.DB_TELEMETRY_URL = "https://database.test/health";
  globalThis.fetch = async (input) => {
    requests += 1;
    const url = new URL(input);
    if (url.hostname === "logs.test") return Response.json({ entries: [{ ...expectedLogs.entries[0], metadata: {} }] });
    assert.equal(url.hostname, "database.test");
    return Response.json({ ...expectedDatabase, provider: "postgresql", database: "production", metadata: {} });
  };
  const httpLogs = await runLogAgent(incident, repository, ci);
  const httpDatabase = await runDatabaseAgent(incident, repository, ci, httpLogs);
  assert.equal(httpLogs.status, "complete");
  assert.equal(httpDatabase.status, "complete");
  assert.equal(requests, 2);
  assert.equal(httpLogs.evidence[0].metadata.simulated, false);
  assert.equal(httpDatabase.evidence[0].metadata.simulated, false);
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  const failedLogs = await runLogAgent(incident, repository, ci);
  const failedDatabase = await runDatabaseAgent(incident, repository, ci, failedLogs);
  for (const result of [failedLogs, failedDatabase]) {
    assert.equal(result.status, "error", "Real endpoint failures must never fall back to simulation");
    assert.deepEqual(result.evidence, []);
  }
  console.log("PASS: simulated fixtures, filtering, validation, isolation, agent correlation, explicit opt-in, labeling, and HTTP selection");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(output, { recursive: true, force: true });
}
