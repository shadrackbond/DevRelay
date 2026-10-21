import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("packages/core/package.json", root));
const output = mkdtempSync(join(tmpdir(), "devrelay-approval-"));
const originalNow = Date.now;
const originalFetch = globalThis.fetch;
try {
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
    "--project", fileURLToPath(new URL("packages/core/tsconfig.json", root)),
    "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", output,
  ], { stdio: "inherit" });
  const core = require(join(output, "index.js"));
  globalThis.fetch = () => { throw new Error("Approval must not execute external actions"); };
  const { packet } = await core.runCheckoutInvestigation();
  const before = structuredClone(packet);
  const actionId = packet.actions[0].id;
  for (const risk of ["low", "medium", "high"]) {
    for (const approval of ["not-required", "required", "approved", "rejected"]) {
      const action = { ...packet.actions[0], risk, approval };
      assert.equal(core.requiresHumanApproval(action), risk !== "low" || approval !== "not-required");
      assert.equal(core.isActionApprovalSatisfied(action), approval === "approved" || (risk === "low" && approval === "not-required"));
    }
  }
  for (const decision of ["approved", "rejected"]) {
    const updated = core.recordActionDecision(packet, actionId, decision);
    assert.equal(updated.actions[0].approval, decision);
    assert.equal(core.isActionApprovalSatisfied(updated.actions[0]), decision === "approved");
    assert.deepEqual(updated.hypothesis, packet.hypothesis);
    assert.deepEqual(updated.evidence, packet.evidence);
    assert.deepEqual(updated.actions.slice(1), packet.actions.slice(1));
    assert.equal(updated.audit.length, packet.audit.length + 1);
    assert.equal(updated.audit.at(-1).metadata.actionId, actionId);
    assert.equal(updated.audit.at(-1).metadata.description, packet.actions[0].description);
    assert.equal(updated.audit.at(-1).actor, "demo-reviewer");
    assert.equal(updated.audit.at(-1).action, `action-${decision}`);
    assert.ok(Number.isFinite(Date.parse(updated.audit.at(-1).timestamp)));
    for (const replay of ["approved", "rejected"]) assert.throws(() => core.recordActionDecision(updated, actionId, replay), /final decision/);
    for (const view of core.renderAllBorderlessRelayViews(updated)) {
      assert.ok(core.verifyBorderlessRelayInvariant(updated, view).valid);
      assert.equal(view.safetyGate, "human-approval-required", "Policy must survive approval and rejection");
      assert.equal(view.actions[0].approval, decision);
      assert.match(view.compactText ?? view.presentation, new RegExp(decision));
    }
    const oldView = core.renderAllBorderlessRelayViews(packet)[0];
    assert.ok(!core.verifyBorderlessRelayInvariant(updated, oldView).valid);
  }
  assert.deepEqual(packet, before, "Decisions cannot mutate the source proposal");
  assert.throws(() => core.recordActionDecision(packet, "foreign-action", "approved"), /does not belong/);
  assert.throws(() => core.recordActionDecision(packet, packet.actions[1].id, "approved"), /does not require/);
  assert.throws(() => core.recordActionDecision(packet, actionId, "not-required"), /Invalid/);
  const mislabeled = { ...packet, actions: [{ ...packet.actions[0], risk: "high", approval: "not-required" }] };
  assert.equal(core.isActionApprovalSatisfied(mislabeled.actions[0]), false);
  assert.equal(core.renderAllBorderlessRelayViews(mislabeled)[0].safetyGate, "human-approval-required");
  assert.equal(core.recordActionDecision(mislabeled, actionId, "approved").actions[0].approval, "approved");

  const ts = require("typescript");
  const modules = new Map();
  function load(file) {
    const url = new URL(file, root);
    if (modules.has(url.href)) return modules.get(url.href).exports;
    const module = { exports: {} };
    modules.set(url.href, module);
    const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    new Function("require", "module", "exports", compiled.outputText)((name) => {
      if (name === "@devrelay/core") return core;
      if (name === "server-only") return {};
      if (name.startsWith(".")) return load(new URL(`${name}.ts`, url));
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  const { createApprovalSession } = load("apps/web/app/lib/approval-store.ts");
  const { decideApproval } = load("apps/web/app/actions/approvals.ts");
  function form(id = actionId, decision = "approved") {
    const data = new FormData();
    data.set("actionId", id);
    data.set("decision", decision);
    return data;
  }
  const first = createApprovalSession(packet);
  const second = createApprovalSession({ ...packet, incident: { ...packet.incident, id: "another-incident" }, actions: [{ ...packet.actions[0], id: "another-action" }] });
  assert.notEqual(first, second);
  assert.equal((await decideApproval("unknown-session", form())).error, true);
  assert.equal((await decideApproval(second, form())).error, true, "An action from a different proposal must be rejected");
  for (const invalid of [null, {}, form(actionId, "not-required"), form("unknown"), form("x".repeat(161)), new FormData()]) {
    const result = await decideApproval(first, invalid);
    assert.equal(result.error, true);
    assert.equal(result.packet.actions[0].approval, "required");
    assert.equal(result.packet.audit.length, packet.audit.length);
  }
  const rejected = await decideApproval(first, form(actionId, "rejected"));
  assert.equal(rejected.error, false);
  rejected.packet.actions[0].approval = "approved";
  const replay = await decideApproval(first, form());
  assert.equal(replay.error, true);
  assert.equal(replay.packet.actions[0].approval, "rejected", "Client state cannot override the server decision");
  assert.equal(replay.packet.audit.length, packet.audit.length + 1);
  const approved = await decideApproval(second, form("another-action"));
  assert.equal(approved.error, false);
  assert.equal(approved.packet.incident.id, "another-incident");
  const concurrent = createApprovalSession(packet);
  const outcomes = await Promise.all([decideApproval(concurrent, form()), decideApproval(concurrent, form(actionId, "rejected"))]);
  assert.equal(outcomes.filter((result) => !result.error).length, 1);
  assert.equal(outcomes[1].packet.audit.length, packet.audit.length + 1);
  const snapshot = structuredClone(packet);
  const snapshotSession = createApprovalSession(snapshot);
  snapshot.actions[0].description = "Tampered proposal";
  const snapshotDecision = await decideApproval(snapshotSession, form());
  assert.equal(snapshotDecision.packet.actions[0].description, packet.actions[0].description);
  const staleSession = createApprovalSession(packet);
  const now = Date.now();
  Date.now = () => now + 30 * 60 * 1000 + 1;
  assert.equal((await decideApproval(staleSession, form())).error, true, "Expired decisions must fail closed");
  Date.now = originalNow;
  const evicted = createApprovalSession(packet);
  for (let i = 0; i < 100; i++) createApprovalSession(packet);
  assert.equal((await decideApproval(evicted, form())).error, true, "Evicted reviews must fail closed");
  assert.deepEqual(packet, before);
  console.log("PASS: risk policy, approval/rejection, replay blocking, server snapshot isolation, invalid/foreign inputs, expiry, capacity, audit, and Relay invariants");
} finally {
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
  rmSync(output, { recursive: true, force: true });
}
