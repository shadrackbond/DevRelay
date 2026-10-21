import "server-only";
import { randomUUID } from "node:crypto";
import { recordActionDecision, type CanonicalReasoningPacket } from "@devrelay/core";

// shortcut: snapshots live in one process for 30 minutes, replace with authenticated durable storage before production execution.
const sessions = new Map<string, { packet: CanonicalReasoningPacket; expiresAt: number }>();
const lifetime = 30 * 60 * 1000;

export function createApprovalSession(packet: CanonicalReasoningPacket): string {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(id);
  }
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
  const id = randomUUID();
  sessions.set(id, { packet: structuredClone(packet), expiresAt: Date.now() + lifetime });
  return id;
}

export function decideApprovalSession(sessionId: string, formData: FormData) {
  const session = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return { error: true, message: "This review expired or is unavailable. Reload to review a new proposal. No action was executed." };
  }
  if (!(formData instanceof FormData)) {
    return { packet: structuredClone(session.packet), error: true, message: "Invalid decision form. No action was executed." };
  }
  const actionId = formData.get("actionId");
  const decision = formData.get("decision");
  if (typeof actionId !== "string" || actionId.length > 160 || (decision !== "approved" && decision !== "rejected")) {
    return { packet: structuredClone(session.packet), error: true, message: "Invalid action or decision. No action was executed." };
  }
  try {
    session.packet = recordActionDecision(session.packet, actionId, decision);
    return { packet: structuredClone(session.packet), error: false, message: `Action ${decision}. No action was executed.` };
  } catch (error) {
    return { packet: structuredClone(session.packet), error: true, message: error instanceof Error ? error.message : "Decision could not be recorded." };
  }
}
