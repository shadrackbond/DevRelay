import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("packages/core/package.json", root));
const output = mkdtempSync(join(tmpdir(), "devrelay-approval-"));
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

  console.log("PASS: risk policy, approval/rejection, immutable proposals, audit metadata, and Relay invariants");
} finally {
  globalThis.fetch = originalFetch;
  rmSync(output, { recursive: true, force: true });
}
