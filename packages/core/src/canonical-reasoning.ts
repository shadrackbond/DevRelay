import type {
  CanonicalReasoningPacket,
  Evidence,
  Incident,
  RecommendedAction,
  RootCauseHypothesis,
} from "./types";

export function buildReasoningPacket(input: {
  incident: Incident;
  evidence: Evidence[];
  hypothesis: RootCauseHypothesis;
  actions?: RecommendedAction[];
}): CanonicalReasoningPacket {
  const stalePenalty = input.evidence.filter((item) => item.freshness !== "fresh").length * 0.05;
  const confidenceCeiling = Math.max(0, Math.min(1, 1 - stalePenalty));

  return {
    incident: input.incident,
    evidence: input.evidence,
    hypothesis: {
      ...input.hypothesis,
      confidence: Math.min(input.hypothesis.confidence, confidenceCeiling),
    },
    actions: input.actions ?? [],
    confidenceCeiling,
    generatedAt: new Date().toISOString(),
    audit: [
      {
        actor: "reasoning-engine",
        action: "canonical-packet-created",
        timestamp: new Date().toISOString(),
        evidenceIds: input.evidence.map((item) => item.id),
      },
    ],
  };
}

export function assertBorderlessInvariant(
  source: CanonicalReasoningPacket,
  rendered: Pick<CanonicalReasoningPacket, "hypothesis" | "confidenceCeiling">,
): void {
  if (source.hypothesis.statement !== rendered.hypothesis.statement) {
    throw new Error("Borderless invariant violated: root cause changed during rendering.");
  }

  if (source.confidenceCeiling !== rendered.confidenceCeiling) {
    throw new Error("Borderless invariant violated: confidence ceiling changed during rendering.");
  }
}
