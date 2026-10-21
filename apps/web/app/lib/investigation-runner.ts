import "server-only";
import { checkoutIncident, runCheckoutInvestigation, type AuditEntry } from "@devrelay/core";
import { runRepositoryAgent } from "./repository-agent";
import { runCiAgent } from "./ci-agent";
import { runLogAgent } from "./log-agent";
import { runDatabaseAgent } from "./database-agent";
import { runReasoningAgent } from "./reasoning-agent";
import { insertIncident, latestInvestigation, readIncident, saveInvestigation, type InvestigationSnapshot } from "./history-store";
import type { StoredIncident } from "./incident-store";

export async function investigate(ownerId: string, incidentId: string, previousId?: string) {
  const current = latestInvestigation(ownerId, incidentId);
  if (current && current.id !== previousId) return current;
  if (incidentId === "1042") {
    const { packet, stages } = await runCheckoutInvestigation();
    const incident: StoredIncident = { ...checkoutIncident, service: checkoutIncident.service ?? "checkout-service", status: "ready", updatedAt: checkoutIncident.createdAt };
    insertIncident(ownerId, incident);
    if (previousId) packet.audit.push({ actor: "demo-reviewer", action: "investigation-rerun-requested", timestamp: new Date().toISOString() });
    return saveInvestigation(ownerId, incidentId, { packet, details: { kind: "demo", stages } }, previousId);
  }
  const incident = readIncident(ownerId, incidentId);
  if (!incident) throw new Error("Incident is unavailable.");
  const audit: AuditEntry[] = [{ actor: "coordinator-agent", action: previousId ? "investigation-rerun-requested" : "investigation-started", timestamp: new Date().toISOString() }];
  function collected(actor: string, result: { status: string; summary: string; error?: string; evidence: { id: string }[] }) {
    audit.push({ actor, action: `evidence-${result.status}`, timestamp: new Date().toISOString(), evidenceIds: result.evidence.map((item) => item.id), metadata: { summary: result.summary, error: result.error } });
  }
  const repositoryResult = await runRepositoryAgent(incident);
  collected("repository-agent", repositoryResult);
  const ciResult = await runCiAgent(incident, repositoryResult);
  collected("ci-agent", ciResult);
  const logResult = await runLogAgent(incident, repositoryResult, ciResult);
  collected("log-agent", logResult);
  const databaseResult = await runDatabaseAgent(incident, repositoryResult, ciResult, logResult);
  collected("database-agent", databaseResult);
  const { packet, ...reasoningResult } = runReasoningAgent({ incident, repositoryResult, ciResult, logResult, databaseResult });
  packet.audit = [...audit, ...packet.audit];
  const snapshot: InvestigationSnapshot = { packet, details: { kind: "live", repositoryResult, ciResult, logResult, databaseResult, reasoningResult } };
  return saveInvestigation(ownerId, incidentId, snapshot, previousId);
}
