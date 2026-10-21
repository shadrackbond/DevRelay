import type { CanonicalReasoningPacket, RecommendedAction } from "./types";

export function requiresHumanApproval(action: RecommendedAction): boolean {
  return action.risk !== "low" || action.approval !== "not-required";
}

export function isActionApprovalSatisfied(action: RecommendedAction): boolean {
  return action.approval === "approved" || !requiresHumanApproval(action);
}

export function recordActionDecision(
  packet: CanonicalReasoningPacket,
  actionId: string,
  decision: "approved" | "rejected",
): CanonicalReasoningPacket {
  if (decision !== "approved" && decision !== "rejected") throw new Error("Invalid approval decision.");
  const action = packet.actions.find((item) => item.id === actionId);
  if (!action) throw new Error("This action does not belong to the proposal.");
  if (!requiresHumanApproval(action)) throw new Error("This action does not require approval.");
  if (action.approval === "approved" || action.approval === "rejected") {
    throw new Error("This proposal already has a final decision. Start a new review to reconsider it.");
  }

  return {
    ...packet,
    actions: packet.actions.map((item) => item.id === actionId ? { ...item, approval: decision } : item),
    audit: [...packet.audit, {
      actor: "demo-reviewer",
      action: `action-${decision}`,
      timestamp: new Date().toISOString(),
      metadata: { actionId, description: action.description, risk: action.risk, decision, execution: "unavailable" },
    }],
  };
}
