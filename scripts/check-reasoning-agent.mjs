import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("packages/core/package.json", root));
const output = mkdtempSync(join(tmpdir(), "devrelay-reasoning-"));
const originalFetch = globalThis.fetch;
const envKeys = ["LOG_SOURCE_URL", "DB_TELEMETRY_URL"];
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

try {
  for (const name of ["core", "integrations"]) {
    execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
      "--project", fileURLToPath(new URL(`packages/${name}/tsconfig.json`, root)),
      "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", join(output, name),
    ], { stdio: "inherit" });
  }
  const core = require(join(output, "core/index.js"));
  const integrations = require(join(output, "integrations/index.js"));
  const typescript = require("typescript");
  const modules = new Map();
  function load(file) {
    const url = new URL(file, root);
    if (modules.has(url.href)) return modules.get(url.href).exports;
    const module = { exports: {} };
    modules.set(url.href, module);
    const compiled = typescript.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
    });
    new Function("require", "module", "exports", compiled.outputText)((name) => {
      if (name === "@devrelay/core") return core;
      if (name === "@devrelay/integrations") return integrations;
      if (name.startsWith(".")) return load(new URL(`${name}.ts`, url));
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  globalThis.fetch = () => { throw new Error("Reasoning checks must not access the network"); };
  const { runReasoningAgent } = load("apps/web/app/lib/reasoning-agent.ts");
  const { BENCHMARK_CASES } = load("apps/web/evaluation/benchmarks.ts");
  const { runEvaluationSuite } = load("apps/web/evaluation/harness.ts");
  const { assertEvaluationThresholds } = load("apps/web/evaluation/thresholds.ts");
  const baseline = structuredClone(BENCHMARK_CASES[0]);
  const groups = (input) => [input.repositoryResult, input.ciResult, input.logResult, input.databaseResult];
  function check(input) {
    const before = structuredClone(input);
    const result = runReasoningAgent(input);
    assert.deepEqual(input, before, "Reasoning must not mutate agent results");
    const { packet } = result;
    assert.ok(Number.isFinite(packet.hypothesis.confidence));
    assert.ok(packet.hypothesis.confidence >= 0 && packet.hypothesis.confidence <= packet.confidenceCeiling);
    assert.equal(new Set(packet.evidence.map((item) => item.id)).size, packet.evidence.length);
    for (const id of packet.hypothesis.evidenceIds) assert.ok(packet.evidence.some((item) => item.id === id));
    for (const action of packet.actions) {
      if (action.risk !== "low") assert.equal(action.approval, "required");
    }
    for (const view of core.renderAllBorderlessRelayViews(packet)) assert.ok(core.verifyBorderlessRelayInvariant(packet, view).valid);
    if (result.status === "insufficient-evidence") {
      assert.equal(result.winningCandidate, undefined);
      assert.deepEqual(packet.hypothesis.evidenceIds, []);
      assert.deepEqual(packet.actions.map((action) => action.id), ["action-collect-evidence"]);
    } else {
      assert.equal(packet.hypothesis.confidence, result.winningCandidate.confidence);
      assert.ok(result.winningCandidate.supportingEvidenceIds.length >= 2);
    }
    return result;
  }
  const complete = check(baseline);
  assert.equal(complete.status, "complete");
  assert.deepEqual(complete.packet.hypothesis.evidenceIds, ["github-c-db-pool", "logs-c-db-pool", "database-c-db-pool"]);
  assert.ok(complete.packet.evidence.some((item) => item.id === "ci-c-db-pool"), "Neutral CI must remain in the packet as context");
  assert.ok(complete.packet.hypothesis.missingEvidence.includes("CI is inconclusive."));
  assert.ok(complete.packet.actions.some((action) => action.id === "action-prepare-rollback" && action.approval === "required"));
  function withoutClock(result) {
    const copy = structuredClone(result);
    delete copy.packet.generatedAt;
    for (const entry of copy.packet.audit) delete entry.timestamp;
    return copy;
  }
  assert.deepEqual(withoutClock(check(baseline)), withoutClock(complete));

  const failed = structuredClone(baseline);
  for (const result of groups(failed).slice(1)) result.status = "error";
  assert.deepEqual(check(failed).availableSources, ["repository"], "Failed sources cannot contribute cached findings");
  const empty = structuredClone(baseline);
  for (const result of groups(empty).slice(1)) result.evidence = [];
  assert.equal(check(empty).status, "insufficient-evidence", "Successful requests without evidence do not corroborate a cause");
  const noRepository = structuredClone(baseline);
  noRepository.repositoryResult.evidence = [];
  noRepository.logResult.evidence[0].id = "github-c-db-pool";
  assert.deepEqual(check(noRepository).candidates, [], "Repository provenance must have the right source kind");
  const untraced = structuredClone(baseline);
  untraced.logResult.evidence = untraced.logResult.evidence.filter((item) => item.id !== "logs-c-db-pool");
  const untracedWinner = check(untraced).candidates.find((item) => item.candidateId === "c-db-pool");
  assert.equal(untracedWinner.logSignal, "unavailable");
  assert.ok(!untracedWinner.supportingEvidenceIds.includes("logs-c-db-pool"));

  const neutral = structuredClone(baseline);
  neutral.repositoryResult.candidates[0].score = 100;
  for (const result of [neutral.logResult, neutral.databaseResult]) {
    for (const finding of result.findings) { finding.signal = "neutral"; finding.supportScore = 100; }
  }
  assert.equal(check(neutral).status, "insufficient-evidence", "Neutral sources are not independent support");
  const contradicted = structuredClone(baseline);
  for (const result of [contradicted.logResult, contradicted.databaseResult]) {
    for (const finding of result.findings) { finding.signal = "contradicts"; finding.supportScore = 100; }
  }
  const negative = check(contradicted);
  assert.equal(negative.status, "insufficient-evidence");
  assert.deepEqual(negative.candidates[0].contradictingEvidenceIds, ["logs-c-db-pool", "database-c-db-pool"]);
  assert.equal(negative.packet.audit.at(-1).metadata.contradictingEvidenceIds.length, 2);
  contradicted.logResult.findings[0].supportScore = NaN;
  assert.ok(check(contradicted).candidates[0].contradictingEvidenceIds.includes("logs-c-db-pool"), "A missing numeric score must not erase a traceable contradiction");

  const stale = structuredClone(baseline);
  for (const result of groups(stale)) for (const item of result.evidence) item.freshness = "stale";
  const bounded = check(stale);
  assert.equal(bounded.status, "complete");
  assert.ok(bounded.packet.hypothesis.confidence <= 0.61);
  assert.ok(!bounded.packet.actions.some((action) => action.risk !== "low"), "Freshness must bound action selection");
  for (let index = 0; index < 4; index += 1) stale.databaseResult.evidence.push({ ...stale.databaseResult.evidence[0], id: `old-${index}`, freshness: "unknown" });
  assert.equal(check(stale).status, "insufficient-evidence", "Freshness must be applied before promotion");
  const duplicates = structuredClone(baseline);
  duplicates.ciResult.evidence.push(...Array.from({ length: 20 }, () => structuredClone(duplicates.ciResult.evidence[0])));
  assert.equal(check(duplicates).packet.hypothesis.confidence, complete.packet.hypothesis.confidence);
  const tie = structuredClone(baseline);
  tie.repositoryResult.candidates[1].score = tie.repositoryResult.candidates[0].score;
  for (const result of groups(tie).slice(1)) result.findings[1] = { ...structuredClone(result.findings[0]), candidateId: tie.repositoryResult.candidates[1].id };
  const tied = check(tie);
  assert.equal(tied.status, "insufficient-evidence");
  assert.match(tied.packet.hypothesis.contradictions.join(" "), /Competing candidate/);
  assert.deepEqual(tied.candidates[0].contradictions, [], "Packet warnings must not mutate candidate contradictions");
  const invalid = structuredClone(baseline);
  invalid.repositoryResult.candidates[0].score = NaN;
  invalid.logResult.findings[0].supportScore = Infinity;
  invalid.databaseResult.findings[0].supportScore = -100;
  assert.ok(!check(invalid).candidates.some((item) => item.candidateId === "c-db-pool"));
  invalid.repositoryResult.candidates[0].score = 82;
  invalid.logResult.findings[0].supportScore = undefined;
  const invalidScores = check(invalid);
  assert.equal(invalidScores.status, "insufficient-evidence", "Missing or invalid numerical scores must not add confidence");
  assert.ok(!invalidScores.candidates[0].supportingEvidenceIds.includes("logs-c-db-pool"));
  assert.ok(!invalidScores.candidates[0].supportingEvidenceIds.includes("database-c-db-pool"));
  const absent = structuredClone(baseline);
  for (const result of groups(absent)) result.status = "error";
  assert.equal(check(absent).packet.hypothesis.confidence, 0);
  assert.equal(check(BENCHMARK_CASES[7]).status, "insufficient-evidence", "Repository and CI alone must not borrow missing runtime confidence");

  const { runLogAgent } = load("apps/web/app/lib/log-agent.ts");
  const { runDatabaseAgent } = load("apps/web/app/lib/database-agent.ts");
  process.env.LOG_SOURCE_URL = integrations.SIMULATED_CHECKOUT_SOURCE;
  process.env.DB_TELEMETRY_URL = integrations.SIMULATED_CHECKOUT_SOURCE;
  const simulated = structuredClone(baseline);
  simulated.repositoryResult.candidates = simulated.repositoryResult.candidates.slice(0, 1);
  simulated.ciResult = { ...simulated.ciResult, status: "error", findings: [], evidence: [] };
  simulated.logResult = await runLogAgent(simulated.incident, simulated.repositoryResult, simulated.ciResult);
  simulated.databaseResult = await runDatabaseAgent(simulated.incident, simulated.repositoryResult, simulated.ciResult, simulated.logResult);
  const replay = check(simulated);
  assert.equal(replay.status, "complete");
  assert.match(replay.packet.hypothesis.statement, /^In the simulated scenario/);
  assert.ok(replay.packet.hypothesis.missingEvidence.some((item) => item.includes("live evidence")));
  assert.equal(replay.packet.audit.at(-1).metadata.simulated, true);

  const report = runEvaluationSuite(BENCHMARK_CASES);
  assertEvaluationThresholds(report);
  assert.ok(report.cases.every((item) => item.correctTop1), "Every labeled benchmark should select correctly or abstain");
  console.log(`PASS: grounded synthesis, abstention, source failures, contradictions, freshness, approval, simulation, relay invariants, and ${report.cases.length} benchmarks`);
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(output, { recursive: true, force: true });
}
