import type { Evidence } from "@devrelay/core";
import {
  DatabaseTelemetryProviderError,
  HttpDatabaseTelemetryProvider,
  SIMULATED_CHECKOUT_SOURCE,
  SimulatedDatabaseTelemetryProvider,
  type DatabaseTelemetrySnapshot,
} from "@devrelay/integrations";
import type { CiAgentResult } from "./ci-agent";
import type { StoredIncident } from "./incident-store";
import type { LogAgentResult } from "./log-agent";
import type { RepositoryAgentResult, RepositoryCandidate } from "./repository-agent";

export type DatabaseSignal = "supports" | "contradicts" | "neutral";

export interface DatabaseFinding {
  candidateId: string;
  candidateTitle: string;
  signal: DatabaseSignal;
  supportScore: number;
  summary: string;
  reasons: string[];
}

export interface DatabaseAgentResult {
  status: "complete" | "unconfigured" | "error";
  source: string;
  summary: string;
  snapshot?: DatabaseTelemetrySnapshot;
  findings: DatabaseFinding[];
  evidence: Evidence[];
  error?: string;
}

function scoreSnapshot(snapshot: DatabaseTelemetrySnapshot): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  if (snapshot.connections.utilizationPercent >= 95) {
    score += 32;
    reasons.push(
      `Connection utilization is critical at ${snapshot.connections.utilizationPercent}%.`,
    );
  } else if (snapshot.connections.utilizationPercent >= 80) {
    score += 20;
    reasons.push(
      `Connection utilization is elevated at ${snapshot.connections.utilizationPercent}%.`,
    );
  }

  if (snapshot.connections.waiting >= 20) {
    score += 24;
    reasons.push(
      `${snapshot.connections.waiting} database sessions are waiting for capacity.`,
    );
  } else if (snapshot.connections.waiting > 0) {
    score += 12;
    reasons.push(
      `${snapshot.connections.waiting} database session(s) are waiting.`,
    );
  }

  if (snapshot.locks.blockedSessions >= 5) {
    score += 20;
    reasons.push(
      `${snapshot.locks.blockedSessions} sessions are blocked by database locks.`,
    );
  } else if (snapshot.locks.blockedSessions > 0) {
    score += 10;
    reasons.push(
      `${snapshot.locks.blockedSessions} blocked session(s) detected.`,
    );
  }

  if (snapshot.queries.longRunning >= 10) {
    score += 14;
    reasons.push(
      `${snapshot.queries.longRunning} long-running queries are active.`,
    );
  } else if (snapshot.queries.longRunning > 0) {
    score += 7;
    reasons.push(
      `${snapshot.queries.longRunning} long-running query/query(s) detected.`,
    );
  }

  if (snapshot.queries.longestSeconds >= 60) {
    score += 10;
    reasons.push(
      `Longest-running query has been active for ${snapshot.queries.longestSeconds}s.`,
    );
  }

  const dominantWait = [...snapshot.waits].sort((a, b) => b.count - a.count)[0];
  if (dominantWait && dominantWait.count > 0) {
    score += Math.min(12, dominantWait.count);
    reasons.push(
      `Dominant wait event: ${dominantWait.type}/${dominantWait.event} (${dominantWait.count}).`,
    );
  }

  return { score: Math.min(100, score), reasons };
}

function candidateAdjustment(
  candidate: RepositoryCandidate,
  ciResult: CiAgentResult,
  logResult: LogAgentResult,
): number {
  let adjustment = 0;

  const ci = ciResult.findings.find((item) => item.candidateId === candidate.id);
  const logs = logResult.findings.find((item) => item.candidateId === candidate.id);

  if (ci?.signal === "supports") adjustment += 5;
  if (ci?.signal === "contradicts") adjustment -= 5;

  if (logs?.signal === "supports") adjustment += 12;
  if (logs?.signal === "contradicts") adjustment -= 12;

  return adjustment;
}

function makeFinding(
  candidate: RepositoryCandidate,
  snapshot: DatabaseTelemetrySnapshot,
  ciResult: CiAgentResult,
  logResult: LogAgentResult,
): DatabaseFinding {
  const infra = scoreSnapshot(snapshot);
  const adjustment = candidateAdjustment(candidate, ciResult, logResult);
  const supportScore = Math.max(0, Math.min(100, infra.score + adjustment));

  let signal: DatabaseSignal = "neutral";
  if (supportScore >= 60) signal = "supports";
  if (
    snapshot.connections.utilizationPercent < 50 &&
    snapshot.connections.waiting === 0 &&
    snapshot.locks.blockedSessions === 0 &&
    snapshot.queries.longRunning === 0
  ) {
    signal = "contradicts";
  }

  const summary =
    signal === "supports"
      ? `Database telemetry materially supports this candidate (${supportScore}/100).`
      : signal === "contradicts"
        ? "Database health is normal, weakening a database-pressure explanation."
        : "Database telemetry is inconclusive for this candidate.";

  return {
    candidateId: candidate.id,
    candidateTitle: candidate.title,
    signal,
    supportScore,
    summary,
    reasons: infra.reasons,
  };
}

function findingToEvidence(
  finding: DatabaseFinding,
  snapshot: DatabaseTelemetrySnapshot,
): Evidence {
  return {
    id: `database-${finding.candidateId}`,
    source: `database:${snapshot.provider}:${snapshot.database}`,
    kind: "database",
    summary: `${finding.candidateTitle}: ${finding.summary}`,
    observedAt: snapshot.capturedAt,
    freshness: "fresh",
    metadata: {
      simulated: snapshot.metadata?.simulated === true,
      signal: finding.signal,
      supportScore: finding.supportScore,
      reasons: finding.reasons,
      telemetry: snapshot,
    },
  };
}

export async function runDatabaseAgent(
  incident: StoredIncident,
  repositoryResult: RepositoryAgentResult,
  ciResult: CiAgentResult,
  logResult: LogAgentResult,
): Promise<DatabaseAgentResult> {
  const telemetryUrl = process.env.DB_TELEMETRY_URL;

  if (!telemetryUrl) {
    return {
      status: "unconfigured",
      source: "",
      summary: "Database telemetry provider is not configured.",
      findings: [],
      evidence: [],
      error: "Set DB_TELEMETRY_URL to a read-only database health endpoint.",
    };
  }

  const simulated = telemetryUrl === SIMULATED_CHECKOUT_SOURCE;
  const provider = simulated
    ? new SimulatedDatabaseTelemetryProvider()
    : new HttpDatabaseTelemetryProvider(telemetryUrl, process.env.DB_TELEMETRY_TOKEN);

  try {
    const snapshot = await provider.inspect({
      service: incident.service,
      incidentAt: incident.createdAt,
    });

    const candidates = repositoryResult.candidates
      .filter((candidate) => candidate.score >= 20)
      .slice(0, 6);

    const findings = candidates.map((candidate) =>
      makeFinding(candidate, snapshot, ciResult, logResult),
    );

    const supporting = findings.filter((item) => item.signal === "supports").length;
    const contradicting = findings.filter(
      (item) => item.signal === "contradicts",
    ).length;

    return {
      status: "complete",
      source: telemetryUrl,
      summary:
        (simulated ? "Simulated checkout evidence. " : "") +
        `Database telemetry captured ${snapshot.connections.active}/${snapshot.connections.max} active connections, ` +
        `${snapshot.connections.waiting} waiting, and ${snapshot.locks.blockedSessions} blocked session(s). ` +
        `${supporting} candidate(s) supported, ${contradicting} contradicted.`,
      snapshot,
      findings,
      evidence: findings.map((finding) => findingToEvidence(finding, snapshot)),
    };
  } catch (error) {
    const message =
      error instanceof DatabaseTelemetryProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown database telemetry provider error.";

    return {
      status: "error",
      source: telemetryUrl,
      summary: "Database Agent could not inspect telemetry.",
      findings: [],
      evidence: [],
      error: message,
    };
  }
}
