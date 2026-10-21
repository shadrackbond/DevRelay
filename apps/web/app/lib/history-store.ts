import "server-only";
import { randomUUID } from "node:crypto";
import { recordActionDecision, type CanonicalReasoningPacket, type InvestigationStage } from "@devrelay/core";
import { getDatabase, transaction } from "./database";
import type { StoredIncident } from "./incident-store";
import type { RepositoryAgentResult } from "./repository-agent";
import type { CiAgentResult } from "./ci-agent";
import type { LogAgentResult } from "./log-agent";
import type { DatabaseAgentResult } from "./database-agent";
import type { ReasoningAgentResult } from "./reasoning-agent";

type InvestigationDetails = { kind: "demo"; stages: InvestigationStage[] } | {
  kind: "live";
  repositoryResult: RepositoryAgentResult;
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
  reasoningResult: Omit<ReasoningAgentResult, "packet">;
};

export interface InvestigationSnapshot {
  packet: CanonicalReasoningPacket;
  details: InvestigationDetails;
}

export interface StoredInvestigation extends InvestigationSnapshot {
  id: string;
  incidentId: string;
  createdAt: string;
}

export function insertIncident(ownerId: string, incident: StoredIncident): void {
  getDatabase().prepare("INSERT OR IGNORE INTO incidents(owner_id, id, data) VALUES (?, ?, ?)")
    .run(ownerId, incident.id, JSON.stringify(incident));
}

export function readIncident(ownerId: string, id: string): StoredIncident | undefined {
  const row = getDatabase().prepare("SELECT data FROM incidents WHERE owner_id = ? AND id = ?").get(ownerId, id);
  return row ? JSON.parse(String(row.data)) as StoredIncident : undefined;
}

export function readIncidents(ownerId: string): StoredIncident[] {
  return getDatabase().prepare("SELECT data FROM incidents WHERE owner_id = ? AND id != '1042' ORDER BY rowid DESC")
    .all(ownerId).map((row) => JSON.parse(String(row.data)) as StoredIncident);
}

function decodeRun(row: Record<string, unknown> | undefined): StoredInvestigation | undefined {
  if (!row) return undefined;
  return { ...JSON.parse(String(row.snapshot)), id: String(row.id), incidentId: String(row.incident_id), createdAt: String(row.created_at) };
}

export function readInvestigation(ownerId: string, id: string): StoredInvestigation | undefined {
  return decodeRun(getDatabase().prepare("SELECT * FROM investigations WHERE owner_id = ? AND id = ?").get(ownerId, id));
}

export function latestInvestigation(ownerId: string, incidentId: string): StoredInvestigation | undefined {
  return decodeRun(getDatabase().prepare("SELECT * FROM investigations WHERE owner_id = ? AND incident_id = ? ORDER BY sequence DESC LIMIT 1").get(ownerId, incidentId));
}

export function readInvestigationHistory(ownerId: string, incidentId?: string): StoredInvestigation[] {
  const rows = incidentId === undefined
    ? getDatabase().prepare("SELECT * FROM investigations WHERE owner_id = ? ORDER BY sequence DESC").all(ownerId)
    : getDatabase().prepare("SELECT * FROM investigations WHERE owner_id = ? AND incident_id = ? ORDER BY sequence DESC").all(ownerId, incidentId);
  return rows.map((row) => decodeRun(row)!);
}

export function saveInvestigation(ownerId: string, incidentId: string, snapshot: InvestigationSnapshot, previousId?: string): StoredInvestigation {
  return transaction((db) => {
    const current = latestInvestigation(ownerId, incidentId);
    // Concurrent initial loads/reruns keep the first committed successor.
    if (current && current.id !== previousId) return current;
    if (previousId && !current) throw new Error("The previous investigation is unavailable.");
    const incident = readIncident(ownerId, incidentId);
    if (!incident || snapshot.packet.incident.id !== incidentId) throw new Error("Investigation does not belong to this incident.");
    const run = { ...snapshot, id: randomUUID(), incidentId, createdAt: new Date().toISOString() };
    db.prepare("INSERT INTO investigations(id, owner_id, incident_id, created_at, snapshot) VALUES (?, ?, ?, ?, ?)")
      .run(run.id, ownerId, incidentId, run.createdAt, JSON.stringify(snapshot));
    incident.status = snapshot.details.kind === "demo" || snapshot.details.reasoningResult.status === "complete" ? "ready" : "awaiting-evidence";
    incident.updatedAt = run.createdAt;
    db.prepare("UPDATE incidents SET data = ? WHERE owner_id = ? AND id = ?").run(JSON.stringify(incident), ownerId, incidentId);
    return structuredClone(run);
  });
}

export function recordStoredDecision(ownerId: string, runId: string, formData: FormData) {
  return transaction((db) => {
    const run = typeof runId === "string" ? readInvestigation(ownerId, runId) : undefined;
    if (!run) return { error: true, message: "This investigation is unavailable. Reload to review the current proposal. No action was executed." };
    if (latestInvestigation(ownerId, run.incidentId)?.id !== runId) {
      return { packet: run.packet, error: true, message: "This proposal has been superseded. Open the current investigation to make a decision." };
    }
    const actionId = formData instanceof FormData ? formData.get("actionId") : null;
    const decision = formData instanceof FormData ? formData.get("decision") : null;
    if (typeof actionId !== "string" || actionId.length > 160 || (decision !== "approved" && decision !== "rejected")) {
      return { packet: run.packet, error: true, message: "Invalid action or decision. No action was executed." };
    }
    let packet: CanonicalReasoningPacket;
    try {
      packet = recordActionDecision(run.packet, actionId, decision);
    } catch (error) {
      return { packet: run.packet, error: true, message: error instanceof Error ? error.message : "Decision could not be recorded." };
    }
    db.prepare("UPDATE investigations SET snapshot = ? WHERE owner_id = ? AND id = ?")
      .run(JSON.stringify({ packet, details: run.details }), ownerId, runId);
    return { packet, error: false, message: `Action ${decision} and saved to history. No action was executed.` };
  });
}
