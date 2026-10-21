import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const core = new URL("../packages/core/", import.meta.url);
const require = createRequire(new URL("package.json", core));
const output = mkdtempSync(join(tmpdir(), "devrelay-demo-"));

try {
  // Compile with the existing dependency so this check also runs on Node 22.
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
    "--project", fileURLToPath(new URL("tsconfig.json", core)),
    "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", output,
  ], { stdio: "inherit" });
  const { runCheckoutInvestigation, renderAllBorderlessRelayViews, verifyBorderlessRelayInvariant, relayInvariantId } = require(join(output, "index.js"));
  globalThis.fetch = () => { throw new Error("The seeded demo must not access the network"); };

  const result = await runCheckoutInvestigation();
  assert.deepEqual(await runCheckoutInvestigation(), result, "Repeated runs must be identical");
  const { packet, stages } = result;
  assert.equal(packet.incident.id, "1042");
  assert.equal(packet.incident.severity, "critical");
  assert.match(packet.incident.description, /0\.2% to 8\.7%/);
  assert.equal(packet.generatedAt, "2026-10-19T20:45:00.000Z");
  assert.equal(packet.hypothesis.confidence, 0.91);
  assert.ok(packet.hypothesis.confidence <= packet.confidenceCeiling);
  assert.match(packet.hypothesis.statement, /PR #483.*database connection pool.*timeouts/);
  assert.deepEqual(packet.evidence.map((item) => item.kind), ["repository", "ci", "logs", "database"]);
  assert.equal(new Set(packet.evidence.map((item) => item.id)).size, 4);
  const evidence = new Map(packet.evidence.map((item) => [item.id, item]));
  for (const item of packet.evidence) {
    assert.ok(item.source && item.uri);
    assert.equal(item.freshness, "fresh");
    assert.ok(Date.parse(item.observedAt) <= Date.parse(packet.generatedAt));
  }
  assert.equal(evidence.get("ev-pr-483").metadata.after, 80);
  assert.equal(evidence.get("ev-log-timeouts").metadata.count, 1248);
  assert.equal(evidence.get("ev-db-pool").metadata.activeConnections, 100);
  assert.equal(evidence.get("ev-db-pool").metadata.waitingRequests, 56);
  assert.equal(evidence.get("ev-ci-1142").metadata.status, "passed");
  assert.deepEqual(packet.hypothesis.evidenceIds, ["ev-pr-483", "ev-log-timeouts", "ev-db-pool"]);
  assert.match(packet.hypothesis.contradictions.join(" "), /CI passed.*concurrency test/);
  assert.ok(packet.hypothesis.missingEvidence.length > 0);
  const mitigation = packet.actions.find((action) => action.id === "action-reduce-workers");
  assert.equal(mitigation.approval, "required");
  assert.match(mitigation.description, /80 to 30/);
  assert.equal(stages.length, 6);
  assert.equal(stages.at(-1).status, "awaiting-approval");

  let previous = Date.parse(packet.incident.createdAt);
  const collected = new Set();
  for (const entry of packet.audit) {
    const timestamp = Date.parse(entry.timestamp);
    assert.ok(timestamp >= previous && timestamp <= Date.parse(packet.generatedAt), "Audit must be chronological");
    previous = timestamp;
    for (const id of entry.evidenceIds ?? []) {
      assert.ok(evidence.has(id), `Unknown audit evidence: ${id}`);
      assert.ok(Date.parse(evidence.get(id).observedAt) <= timestamp, "Evidence must exist before collection or reasoning");
      if (entry.action === "evidence-collected") collected.add(id);
    }
  }
  assert.deepEqual([...collected], [...evidence.keys()]);
  assert.equal(packet.audit.at(-1).action, "mutation-awaiting-human-approval");

  const views = renderAllBorderlessRelayViews(packet);
  assert.equal(views.length, 4);
  assert.ok(views.every((view) => verifyBorderlessRelayInvariant(packet, view).valid));
  const compact = views.find((view) => view.mode === "low-bandwidth");
  for (const value of [...packet.hypothesis.evidenceIds, ...packet.hypothesis.missingEvidence, ...packet.hypothesis.contradictions]) {
    assert.ok(compact.compactText.includes(value), `Text export lost: ${value}`);
  }
  for (const action of packet.actions) {
    assert.ok(compact.compactText.includes(action.description));
    assert.ok(compact.compactText.includes(`risk=${action.risk}; approval=${action.approval}`));
  }
  assert.ok(!verifyBorderlessRelayInvariant(packet, { ...compact, compactText: "APPROVAL: NOT REQUIRED" }).valid);
  assert.ok(!verifyBorderlessRelayInvariant(packet, { ...views[0], compactText: "An unverified replacement message" }).valid);
  const changedAction = structuredClone(packet);
  changedAction.actions[0].description = "A different mitigation";
  assert.notEqual(relayInvariantId(changedAction), relayInvariantId(packet), "Message identity must include action descriptions");
  const emptyPacket = { ...packet, actions: [], hypothesis: { ...packet.hypothesis, evidenceIds: [], missingEvidence: [], contradictions: [] } };
  const emptyCompact = renderAllBorderlessRelayViews(emptyPacket).find((view) => view.mode === "low-bandwidth").compactText;
  assert.ok(emptyCompact.includes("EVIDENCE: NONE") && emptyCompact.includes("ACTION: NONE"));

  const expected = structuredClone(result);
  packet.incident.title = "Changed by a caller";
  packet.evidence[0].metadata.after = 999;
  mitigation.approval = "approved";
  assert.deepEqual(await runCheckoutInvestigation(), expected, "A caller must not alter subsequent demos");
  console.log("PASS: offline checkout demo, repeatability, provenance, audit chronology, approval, run isolation, and complete verified relay exports");
} finally {
  rmSync(output, { recursive: true, force: true });
}
