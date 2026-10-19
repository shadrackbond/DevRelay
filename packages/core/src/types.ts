export type Severity = "low" | "medium" | "high" | "critical";
export type EvidenceFreshness = "fresh" | "stale" | "unknown";
export type ApprovalState = "not-required" | "required" | "approved" | "rejected";

export interface Evidence {
  id: string;
  source: string;
  kind: "repository" | "ci" | "logs" | "database" | "monitoring" | "docs";
  summary: string;
  observedAt: string;
  freshness: EvidenceFreshness;
  uri?: string;
  metadata?: Record<string, unknown>;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  createdAt: string;
  service?: string;
}

export interface RootCauseHypothesis {
  statement: string;
  confidence: number;
  evidenceIds: string[];
  contradictions: string[];
  missingEvidence: string[];
}

export interface RecommendedAction {
  id: string;
  description: string;
  risk: "low" | "medium" | "high";
  approval: ApprovalState;
}

export interface CanonicalReasoningPacket {
  incident: Incident;
  evidence: Evidence[];
  hypothesis: RootCauseHypothesis;
  actions: RecommendedAction[];
  confidenceCeiling: number;
  generatedAt: string;
  audit: AuditEntry[];
}

export interface AuditEntry {
  actor: string;
  action: string;
  timestamp: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}
