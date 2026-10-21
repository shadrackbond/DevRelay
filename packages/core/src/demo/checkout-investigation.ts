import type { AgentResult, DevRelayAgent, AgentContext } from "../agents/base";
import { buildReasoningPacket } from "../canonical-reasoning";
import { IncidentOrchestrator } from "../orchestrator";
import type { CanonicalReasoningPacket, Evidence, Incident, RecommendedAction, RootCauseHypothesis } from "../types";

const NOW = "2026-10-19T20:45:00.000Z";

export const checkoutIncident: Incident = {
  id: "1042",
  title: "Production checkout failing",
  description: "Checkout error rate increased from 0.2% to 8.7% across web and mobile clients.",
  severity: "critical",
  createdAt: "2026-10-19T20:37:00.000Z",
  service: "checkout-service",
};

abstract class SeededAgent implements DevRelayAgent {
  abstract readonly name: string;
  abstract collect(context: AgentContext): Promise<Evidence[]>;

  async investigate(context: AgentContext): Promise<AgentResult> {
    const evidence = await this.collect(context);
    return { agent: this.name, evidence, notes: evidence.map((item) => item.summary) };
  }
}

class RepositoryAgent extends SeededAgent {
  readonly name = "repository-agent";
  async collect(): Promise<Evidence[]> {
    return [{
      id: "ev-pr-483", source: "github", kind: "repository",
      summary: "PR #483 changed checkout concurrency from 20 to 80 workers and was deployed shortly before the incident.",
      observedAt: "2026-10-19T20:18:00.000Z", freshness: "fresh", uri: "github://pull/483",
      metadata: { pullRequest: 483, commit: "6c81fe2", changedSetting: "CHECKOUT_WORKERS", before: 20, after: 80 },
    }];
  }
}

class LogAgent extends SeededAgent {
  readonly name = "log-agent";
  async collect(): Promise<Evidence[]> {
    return [{
      id: "ev-log-timeouts", source: "runtime-logs", kind: "logs",
      summary: "Checkout logs contain 1,248 DB acquisition timeout errors in the last 10 minutes.",
      observedAt: "2026-10-19T20:44:20.000Z", freshness: "fresh", uri: "logs://checkout-service?window=10m",
      metadata: { error: "DB_CONNECTION_ACQUIRE_TIMEOUT", count: 1248, windowMinutes: 10 },
    }];
  }
}

class DatabaseAgent extends SeededAgent {
  readonly name = "database-agent";
  async collect(): Promise<Evidence[]> {
    return [{
      id: "ev-db-pool", source: "postgres-production", kind: "database",
      summary: "Database pool is saturated at 100/100 active connections with 56 requests waiting.",
      observedAt: "2026-10-19T20:44:40.000Z", freshness: "fresh", uri: "db://production/pool-health",
      metadata: { activeConnections: 100, maxConnections: 100, waitingRequests: 56, saturationPercent: 100 },
    }];
  }
}

class CiAgent extends SeededAgent {
  readonly name = "ci-agent";
  async collect(): Promise<Evidence[]> {
    return [{
      id: "ev-ci-1142", source: "github-actions", kind: "ci",
      summary: "Build #1142 passed unit and integration tests; no production-scale concurrency test was present.",
      observedAt: "2026-10-19T20:16:00.000Z", freshness: "fresh", uri: "ci://github-actions/1142",
      metadata: { status: "passed", missingCoverage: "production-scale concurrency" },
    }];
  }
}

export type InvestigationStage = {
  agent: string;
  label: string;
  status: "complete" | "correlating" | "awaiting-approval";
  detail: string;
};

export interface CheckoutInvestigationResult {
  packet: CanonicalReasoningPacket;
  stages: InvestigationStage[];
}

function synthesize(evidence: Evidence[]): { hypothesis: RootCauseHypothesis; actions: RecommendedAction[] } {
  const ids = new Set(evidence.map((item) => item.id));
  const required = ["ev-pr-483", "ev-log-timeouts", "ev-db-pool"];
  const hasRequired = required.every((id) => ids.has(id));

  const hypothesis: RootCauseHypothesis = {
    statement: "PR #483 increased checkout worker concurrency, exhausting the production database connection pool and causing acquisition timeouts.",
    confidence: hasRequired ? 0.91 : 0.62,
    evidenceIds: required.filter((id) => ids.has(id)),
    contradictions: ["CI passed before deployment, but the pipeline did not include a production-scale concurrency test."],
    missingEvidence: ["A production-like load test reproducing the saturation has not yet been executed."],
  };

  const actions: RecommendedAction[] = [
    { id: "action-reduce-workers", description: "Reduce CHECKOUT_WORKERS from 80 to 30 and redeploy the checkout service.", risk: "medium", approval: "required" },
    { id: "action-monitor", description: "Monitor database pool saturation and checkout error rate for 30 minutes after mitigation.", risk: "low", approval: "not-required" },
    { id: "action-load-test", description: "Add a concurrency regression test that models the production database pool limit.", risk: "low", approval: "not-required" },
  ];

  return { hypothesis, actions };
}

export async function runCheckoutInvestigation(): Promise<CheckoutInvestigationResult> {
  const incident = { ...checkoutIncident };
  const agents: DevRelayAgent[] = [new RepositoryAgent(), new CiAgent(), new LogAgent(), new DatabaseAgent()];
  const orchestrator = new IncidentOrchestrator(agents);
  const result = await orchestrator.investigate(incident);
  const { hypothesis, actions } = synthesize(result.evidence);

  const packet = buildReasoningPacket({ incident, evidence: result.evidence, hypothesis, actions });
  packet.generatedAt = NOW;
  packet.audit = [
    { actor: "coordinator-agent", action: "investigation-started", timestamp: "2026-10-19T20:38:00.000Z" },
    { actor: "repository-agent", action: "evidence-collected", timestamp: "2026-10-19T20:39:10.000Z", evidenceIds: ["ev-pr-483"] },
    { actor: "ci-agent", action: "evidence-collected", timestamp: "2026-10-19T20:39:42.000Z", evidenceIds: ["ev-ci-1142"] },
    { actor: "log-agent", action: "evidence-collected", timestamp: "2026-10-19T20:44:25.000Z", evidenceIds: ["ev-log-timeouts"] },
    { actor: "database-agent", action: "evidence-collected", timestamp: "2026-10-19T20:44:45.000Z", evidenceIds: ["ev-db-pool"] },
    { actor: "reasoning-agent", action: "root-cause-synthesized", timestamp: "2026-10-19T20:44:50.000Z", evidenceIds: hypothesis.evidenceIds, metadata: { confidence: hypothesis.confidence } },
    { actor: "policy-gate", action: "mutation-awaiting-human-approval", timestamp: "2026-10-19T20:44:55.000Z", metadata: { actionId: "action-reduce-workers" } },
  ];

  return {
    packet,
    stages: [
      { agent: "repository-agent", label: "Repository Agent", status: "complete", detail: "Linked PR #483 to the incident window." },
      { agent: "ci-agent", label: "CI Agent", status: "complete", detail: "Found a testing gap despite a green deployment." },
      { agent: "log-agent", label: "Log Agent", status: "complete", detail: "Found 1,248 connection acquisition timeouts." },
      { agent: "database-agent", label: "Database Agent", status: "complete", detail: "Confirmed pool saturation and queued requests." },
      { agent: "reasoning-agent", label: "Reasoning Agent", status: "complete", detail: "Correlated 4 sources into a 91% confidence hypothesis." },
      { agent: "policy-gate", label: "Policy Gate", status: "awaiting-approval", detail: "Production mitigation requires human approval." },
    ],
  };
}
