import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const require = createRequire(new URL("packages/core/package.json", root));
const webRequire = createRequire(new URL("apps/web/package.json", root));
const worker = process.argv[2] === "--worker";
const output = worker ? process.argv[3] : mkdtempSync(join(tmpdir(), "devrelay-history-"));
const originalPath = process.env.DEVRELAY_DB_PATH;
const originalFetch = globalThis.fetch;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let activeOwner = owner;
let legacyCookie;
const invalidations = [];
const modules = new Map();
const ts = require("typescript");
function load(file) {
  const url = new URL(file, root);
  if (modules.has(url.href)) return modules.get(url.href).exports;
  const module = { exports: {} };
  modules.set(url.href, module);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  new Function("require", "module", "exports", compiled.outputText)((name) => {
    if (name === "@devrelay/core") return require(join(output, "core/index.js"));
    if (name === "@devrelay/integrations") return require(join(output, "integrations/index.js"));
    if (name === "server-only") return {};
    if (name === "next/server") return webRequire(name);
    if (name === "next/headers") return { cookies: async () => ({ get: (key) => ({ value: key === "devrelay_workspace_v1" ? activeOwner : key === "devrelay_incidents_v1" ? legacyCookie : undefined }) }) };
    if (name === "next/cache") return { revalidatePath: (path) => invalidations.push(path) };
    if (name.startsWith(".")) return load(new URL(`${name}.ts`, url));
    return require(name);
  }, module, module.exports);
  return module.exports;
}
function form(id = "action-reduce-workers", decision = "approved") {
  const result = new FormData();
  result.set("actionId", id);
  result.set("decision", decision);
  return result;
}
function child(mode, id, extraEnv = {}) {
  return execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--worker", output, mode, id ?? ""], {
    encoding: "utf8", env: { ...process.env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
try {
  if (!worker) {
    process.env.DEVRELAY_DB_PATH = join(output, "history.sqlite");
    for (const name of ["core", "integrations"]) {
      execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"),
        "--project", fileURLToPath(new URL(`packages/${name}/tsconfig.json`, root)),
        "--noEmit", "false", "--module", "commonjs", "--moduleResolution", "node", "--outDir", join(output, name),
      ], { stdio: "inherit" });
    }
  }
  globalThis.fetch = () => { throw new Error("History checks must not access the network"); };
  const h = load("apps/web/app/lib/history-store.ts");
  const { getDatabase, transaction } = load("apps/web/app/lib/database.ts");
  if (worker) {
    const mode = process.argv[4];
    const id = process.argv[5];
    if (mode === "inspect") {
      const run = h.readInvestigation(owner, id);
      assert.equal(run.packet.actions[0].approval, "rejected");
      assert.equal(run.packet.audit.at(-1).action, "action-rejected");
      assert.equal(h.readIncidents(owner).length, 12);
      console.log("persisted");
    } else if (mode === "decide-approved" || mode === "decide-rejected") {
      console.log(JSON.stringify(h.recordStoredDecision(owner, id, form(undefined, mode.slice(7)))));
    } else if (mode === "interrupt") {
      getDatabase().exec("BEGIN IMMEDIATE");
      getDatabase().prepare("UPDATE investigations SET snapshot = '{}' WHERE owner_id = ? AND id = ?").run(owner, id);
      process.exit(0);
    } else if (mode === "unavailable") {
      assert.throws(() => getDatabase());
      console.log("failed-closed");
    } else throw new Error("Unknown worker mode");
  } else {
    const core = require(join(output, "core/index.js"));
    const { proxy } = load("apps/web/proxy.ts");
    const { NextRequest } = webRequire("next/server");
    const assigned = proxy(new NextRequest("http://localhost/incidents"));
    const cookie = assigned.cookies.get("devrelay_workspace_v1");
    assert.ok(load("apps/web/app/lib/workspace.ts").isWorkspaceId(cookie.value));
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
    assert.ok(assigned.headers.get("x-middleware-request-cookie").includes(cookie.value));
    assert.equal(proxy(new NextRequest("http://localhost/incidents", { headers: { cookie: `devrelay_workspace_v1=${cookie.value}` } })).cookies.get("devrelay_workspace_v1"), undefined);
    assert.notEqual(proxy(new NextRequest("http://localhost/incidents", { headers: { cookie: "devrelay_workspace_v1=forged" } })).cookies.get("devrelay_workspace_v1").value, "forged");
    const { packet, stages } = await core.runCheckoutInvestigation();
    const { investigate } = load("apps/web/app/lib/investigation-runner.ts");
    const store = load("apps/web/app/lib/incident-store.ts");
    const { decideApproval } = load("apps/web/app/actions/approvals.ts");
    const initialIncident = { ...packet.incident, service: "checkout-service", status: "awaiting-evidence", updatedAt: packet.incident.createdAt };
    h.insertIncident(owner, initialIncident);
    const snapshot = { packet, details: { kind: "demo", stages } };
    const first = h.saveInvestigation(owner, "1042", snapshot);
    assert.equal(h.saveInvestigation(owner, "1042", snapshot).id, first.id, "Initial requests must not create duplicate runs");
    assert.equal(h.readIncident(owner, "1042").status, "ready");
    const before = structuredClone(first);
    packet.actions[0].description = "A client-modified proposal";
    assert.deepEqual(h.readInvestigation(owner, first.id), before, "Persisted proposals must be isolated from caller mutation");
    assert.equal(h.readInvestigation(other, first.id), undefined);
    assert.equal((await decideApproval("unknown", form())).error, true);
    activeOwner = other;
    assert.equal((await decideApproval(first.id, form())).error, true, "A run ID must not authorize a different workspace");
    assert.deepEqual(h.readInvestigationHistory(other), []);
    activeOwner = owner;
    for (const invalid of [null, {}, new FormData(), form("foreign"), form("x".repeat(161)), form(undefined, "not-required")]) {
      const result = await decideApproval(first.id, invalid);
      assert.equal(result.error, true);
      assert.equal(result.packet.actions[0].approval, "required");
    }
    assert.equal((await decideApproval(first.id, form(undefined, "rejected"))).error, false);
    assert.ok(invalidations.includes("/audit"));
    assert.equal((await decideApproval(first.id, form())).error, true);
    assert.equal(h.readInvestigation(owner, first.id).packet.audit.length, before.packet.audit.length + 1);
    assert.equal(h.readInvestigation(owner, first.id).packet.actions[0].approval, "rejected");
    assert.equal(core.isActionApprovalSatisfied(h.readInvestigation(owner, first.id).packet.actions[0]), false);
    for (let i = 0; i < 12; i++) h.insertIncident(owner, { ...initialIncident, id: `INC-TEST-${i}`, title: `Persisted incident ${i}` });
    assert.equal(h.readIncidents(owner).length, 12, "History must not silently discard incidents beyond the old cookie limit");
    assert.equal(child("inspect", first.id), "persisted", "A fresh process must reopen incidents and decisions");
    child("interrupt", first.id);
    assert.equal(h.readInvestigation(owner, first.id).packet.actions[0].approval, "rejected", "An interrupted write must roll back");
    const second = await investigate(owner, "1042", first.id);
    assert.notEqual(second.id, first.id);
    assert.equal(second.packet.actions[0].approval, "required", "A new run must not inherit approval/rejection");
    assert.equal((await decideApproval(first.id, form())).error, true, "Superseded proposals cannot receive new decisions");
    assert.equal(h.saveInvestigation(owner, "1042", snapshot, first.id).id, second.id, "Concurrent reruns must keep the first successor");
    const outcomes = await Promise.all(["approved", "rejected"].map((decision) => new Promise((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, [fileURLToPath(import.meta.url), "--worker", output, `decide-${decision}`, second.id], { env: globalThis.process.env });
      let stdout = "", stderr = "";
      process.stdout.on("data", (data) => { stdout += data; });
      process.stderr.on("data", (data) => { stderr += data; });
      process.on("error", reject);
      process.on("exit", (code) => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
    })));
    assert.equal(outcomes.filter((result) => !result.error).length, 1, "Conflicting processes must commit exactly one decision");
    assert.equal(h.readInvestigation(owner, second.id).packet.audit.length, second.packet.audit.length + 1);
    assert.equal(h.readInvestigationHistory(owner, "1042").length, 2);
    assert.equal(h.readInvestigation(owner, first.id).packet.actions[0].approval, "rejected");

    const third = await investigate(owner, "1042", second.id);
    const db = getDatabase();
    db.exec("CREATE TRIGGER reject_update BEFORE UPDATE ON investigations BEGIN SELECT RAISE(ABORT, 'test write failure'); END;");
    assert.equal((await decideApproval(third.id, form())).error, true);
    assert.deepEqual(h.readInvestigation(owner, third.id), third, "Failed persistence must not record a decision or append its audit");
    db.exec("DROP TRIGGER reject_update");
    await investigate(owner, "1042", third.id);
    const stalePending = await decideApproval(third.id, form());
    assert.equal(stalePending.error, true);
    assert.match(stalePending.message, /superseded/);
    assert.equal(h.readInvestigation(owner, third.id).packet.actions[0].approval, "required");
    const count = h.readInvestigationHistory(owner).length;
    assert.throws(() => transaction((db) => { db.prepare("DELETE FROM investigations WHERE id = ?").run(third.id); throw new Error("rollback"); }));
    assert.equal(h.readInvestigationHistory(owner).length, count);

    const legacy = { ...initialIncident, id: "INC-LEGACY", title: "Migrated incident" };
    legacyCookie = encodeURIComponent(JSON.stringify([legacy, null, { ...legacy, id: "1042" }, { ...legacy, id: "INC-BAD", title: "" }, { ...legacy, createdAt: "yesterday" }]));
    assert.equal(store.decodeLegacyIncidents(legacyCookie).length, 1);
    const imported = await store.listStoredIncidents();
    assert.ok(imported.some((item) => item.id === "INC-LEGACY"));
    await store.listStoredIncidents();
    assert.equal(h.readIncidents(owner).filter((item) => item.id === "INC-LEGACY").length, 1);
    legacyCookie = encodeURIComponent(JSON.stringify([{ ...legacy, title: "Attempted overwrite" }]));
    assert.equal((await store.getStoredIncident("INC-LEGACY")).title, "Migrated incident");
    legacyCookie = undefined;
    for (const malformed of ["%bad", "null", "{}", "[]"]) assert.deepEqual(store.decodeLegacyIncidents(malformed), []);
    activeOwner = undefined;
    await assert.rejects(() => store.getWorkspaceId(), /Workspace is unavailable/);
    activeOwner = owner;
    assert.throws(() => h.saveInvestigation(owner, "INC-TEST-0", snapshot), /does not belong/);
    const live = await investigate(owner, "INC-TEST-0");
    assert.equal(live.details.kind, "live");
    assert.equal(h.readIncident(owner, "INC-TEST-0").status, "awaiting-evidence");
    assert.equal(live.details.reasoningResult.status, "insufficient-evidence");
    assert.ok(live.packet.audit.some((entry) => entry.actor === "repository-agent" && entry.action === "evidence-error"));
    assert.deepEqual(await investigate(owner, "INC-TEST-0"), JSON.parse(JSON.stringify(live)), "Reopening a saved result cannot rerun its providers");
    for (const view of core.renderAllBorderlessRelayViews(h.readInvestigation(owner, first.id).packet)) assert.ok(core.verifyBorderlessRelayInvariant(h.readInvestigation(owner, first.id).packet, view).valid);
    assert.equal(statSync(process.env.DEVRELAY_DB_PATH).mode & 0o777, 0o600);
    const corrupt = join(output, "corrupt.sqlite");
    writeFileSync(corrupt, "not a sqlite database");
    assert.equal(child("unavailable", "", { DEVRELAY_DB_PATH: corrupt }), "failed-closed");
    assert.equal(readFileSync(corrupt, "utf8"), "not a sqlite database", "Corruption must never reset stored history");
    const blocked = join(output, "file-not-directory");
    writeFileSync(blocked, "keep");
    assert.equal(child("unavailable", "", { DEVRELAY_DB_PATH: join(blocked, "history.sqlite") }), "failed-closed");
    getDatabase().close();
    console.log("PASS: durable incidents/snapshots/decisions, fresh-process recovery, workspace isolation, migration, retained versions, stale/replayed decisions, conflicting processes, interrupted/failed writes, and no silent fallback");
  }
} finally {
  globalThis.fetch = originalFetch;
  if (!worker) {
    if (originalPath === undefined) delete process.env.DEVRELAY_DB_PATH;
    else process.env.DEVRELAY_DB_PATH = originalPath;
    rmSync(output, { recursive: true, force: true });
  }
}
