import {
  buildReasoningPacket,
  evidenceConfidenceCeiling,
  type CanonicalReasoningPacket,
  type Evidence,
  type RecommendedAction,
} from "@devrelay/core";
import type { CiAgentResult, CiSignal } from "./ci-agent";
import type { DatabaseAgentResult, DatabaseSignal } from "./database-agent";
import type { StoredIncident } from "./incident-store";
import type { LogAgentResult, LogSignal } from "./log-agent";
import type {
  RepositoryAgentResult,
  RepositoryCandidate,
} from "./repository-agent";

export type ReasoningConfidenceBand =
  | "insufficient"
  | "low"
  | "moderate"
  | "high";

export interface CandidateReasoningScore {
  candidateId: string;
  title: string;
  url: string;
  sha: string;
  repositoryScore: number;
  ciSignal: CiSignal | "unavailable";
  logSignal: LogSignal | "unavailable";
  databaseSignal: DatabaseSignal | "unavailable";
  logSupportScore: number | null;
  databaseSupportScore: number | null;
  rawScore: number;
  confidence: number;
  confidenceBand: ReasoningConfidenceBand;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  supportingReasons: string[];
  contradictions: string[];
  missingEvidence: string[];
}

export interface ReasoningAgentResult {
  status: "complete" | "insufficient-evidence";
  summary: string;
  candidates: CandidateReasoningScore[];
  winningCandidate?: CandidateReasoningScore;
  packet: CanonicalReasoningPacket;
  availableSources: string[];
  missingSources: string[];
}

const WEIGHTS = {
  repository: 0.25,
  ci: 0.15,
  logs: 0.30,
  database: 0.30,
} as const;

function signalScore(signal: string | undefined, score?: number): number {
  if (!signal || signal === "contradicts" || score === undefined || !Number.isFinite(score)) return 0;
  const value = Math.max(0, Math.min(100, score)) / 100;
  return signal === "neutral" ? Math.min(0.5, value) : value;
}

function sourceConfidenceCeiling(sourceCount: number): number {
  if (sourceCount >= 4) return 0.95;
  if (sourceCount === 3) return 0.82;
  if (sourceCount === 2) return 0.65;
  if (sourceCount === 1) return 0.45;
  return 0.25;
}

function confidenceBand(confidence: number): ReasoningConfidenceBand {
  if (confidence < 0.40) return "insufficient";
  if (confidence < 0.55) return "low";
  if (confidence < 0.75) return "moderate";
  return "high";
}

function evidenceIdExists(evidence: Evidence[], id: string, kind: Evidence["kind"]): boolean {
  return evidence.some((item) => item.id === id && item.kind === kind);
}

function scoreCandidate(input: {
  candidate: RepositoryCandidate;
  evidence: Evidence[];
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
  confidenceCeiling: number;
  missingSources: string[];
}): CandidateReasoningScore {
  const {
    candidate,
    evidence,
    ciResult,
    logResult,
    databaseResult,
    confidenceCeiling,
    missingSources,
  } = input;

  const ci = evidenceIdExists(evidence, `ci-${candidate.id}`, "ci")
    ? ciResult.findings.find((item) => item.candidateId === candidate.id)
    : undefined;
  const logs = evidenceIdExists(evidence, `logs-${candidate.id}`, "logs")
    ? logResult.findings.find((item) => item.candidateId === candidate.id &&
      (item.signal === "contradicts" || Number.isFinite(item.supportScore)))
    : undefined;
  const database = evidenceIdExists(evidence, `database-${candidate.id}`, "database")
    ? databaseResult.findings.find((item) => item.candidateId === candidate.id &&
      (item.signal === "contradicts" || Number.isFinite(item.supportScore)))
    : undefined;

  const repositoryComponent = signalScore("supports", candidate.score);
  const ciComponent = signalScore(ci?.signal, ci?.signal === "supports" ? 100 : 50);
  const logComponent = signalScore(logs?.signal, logs?.supportScore);
  const databaseComponent = signalScore(database?.signal, database?.supportScore);

  const rawScore =
    repositoryComponent * WEIGHTS.repository +
    ciComponent * WEIGHTS.ci +
    logComponent * WEIGHTS.logs +
    databaseComponent * WEIGHTS.database;

  const contradictionCount = [
    ci?.signal,
    logs?.signal,
    database?.signal,
  ].filter((signal) => signal === "contradicts").length;

  const contradictionPenalty = contradictionCount * 0.08;
  const confidence = Math.max(
    0,
    Math.min(confidenceCeiling, rawScore - contradictionPenalty),
  );

  const supportingReasons: string[] = [];
  const contradictions: string[] = [];

  supportingReasons.push(
    `Repository candidate correlation: ${candidate.score}/100.`,
  );

  if (ci) {
    if (ci.signal === "supports") supportingReasons.push(ci.summary);
    if (ci.signal === "contradicts") contradictions.push(ci.summary);
  }

  if (logs) {
    if (logs.signal === "supports") {
      supportingReasons.push(...logs.reasons.slice(0, 3));
    }
    if (logs.signal === "contradicts") contradictions.push(logs.summary);
  }

  if (database) {
    if (database.signal === "supports") {
      supportingReasons.push(...database.reasons.slice(0, 3));
    }
    if (database.signal === "contradicts") {
      contradictions.push(database.summary);
    }
  }

  const signals = [["ci", ci, ciComponent], ["logs", logs, logComponent], ["database", database, databaseComponent]] as const;
  const supportingEvidenceIds = [
    `github-${candidate.id}`,
    ...signals.filter(([, finding, component]) => finding?.signal === "supports" && component > 0)
      .map(([source]) => `${source}-${candidate.id}`),
  ];
  const contradictory = signals.filter(([, finding]) => finding?.signal === "contradicts")
    .map(([source]) => `${source}-${candidate.id}`);
  const missingEvidence = missingSources.map(
    (source) => `${source} evidence is unavailable or unconfigured.`,
  );
  for (const [source, finding, component] of signals) {
    if (!finding && !missingSources.includes(source === "logs" ? "runtime logs" : source)) {
      missingEvidence.push(`${source} has no traceable finding for this candidate.`);
    } else if (finding?.signal === "neutral") missingEvidence.push(finding.summary);
    else if (finding?.signal === "supports" && component === 0) {
      missingEvidence.push(`${source} reported support without a positive score.`);
    }
  }

  return {
    candidateId: candidate.id,
    title: candidate.title,
    url: candidate.url,
    sha: candidate.sha,
    repositoryScore: candidate.score,
    ciSignal: ci?.signal ?? "unavailable",
    logSignal: logs?.signal ?? "unavailable",
    databaseSignal: database?.signal ?? "unavailable",
    logSupportScore: logs?.supportScore ?? null,
    databaseSupportScore: database?.supportScore ?? null,
    rawScore,
    confidence,
    confidenceBand: confidenceBand(confidence),
    supportingEvidenceIds,
    contradictingEvidenceIds: contradictory,
    supportingReasons,
    contradictions,
    missingEvidence,
  };
}

function buildActions(
  winner: CandidateReasoningScore | undefined,
): RecommendedAction[] {
  if (!winner || winner.confidenceBand === "insufficient") {
    return [
      {
        id: "action-collect-evidence",
        description:
          "Collect the missing evidence sources before changing production.",
        risk: "low",
        approval: "not-required",
      },
    ];
  }

  const actions: RecommendedAction[] = [
    {
      id: "action-verify-candidate",
      description: `Reproduce or validate the suspected regression around ${winner.title} in a controlled environment.`,
      risk: "low",
      approval: "not-required",
    },
    {
      id: "action-monitor-signals",
      description:
        "Track the runtime and database signals associated with the hypothesis while validating remediation.",
      risk: "low",
      approval: "not-required",
    },
  ];

  if (winner.confidence >= 0.75) {
    actions.unshift({
      id: "action-prepare-rollback",
      description: `Prepare a rollback or revert plan for ${winner.title}; production execution requires human approval.`,
      risk: "medium",
      approval: "required",
    });
  }

  return actions;
}

export function runReasoningAgent(input: {
  incident: StoredIncident;
  repositoryResult: RepositoryAgentResult;
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
}): ReasoningAgentResult {
  const {
    incident,
    repositoryResult,
    ciResult,
    logResult,
    databaseResult,
  } = input;

  const sources = [
    ["repository", "repository", repositoryResult],
    ["ci", "ci", ciResult],
    ["runtime logs", "logs", logResult],
    ["database", "database", databaseResult],
  ] as const;
  const available = sources.filter(([, kind, result]) =>
    result.status === "complete" && result.evidence.some((item) => item.kind === kind),
  );
  const availableSources = available.map(([name]) => name);
  const missingSources = sources.map(([name]) => name).filter((name) => !availableSources.includes(name));
  const evidence = [...new Map(available.flatMap(([, kind, result]) =>
    result.evidence.filter((item) => item.kind === kind),
  ).map((item) => [item.id, item])).values()];
  const confidenceCeiling = Math.min(
    sourceConfidenceCeiling(availableSources.length),
    evidenceConfidenceCeiling(evidence),
  );

  const candidates = repositoryResult.candidates
    .filter((candidate) => Number.isFinite(candidate.score) && candidate.score >= 20 &&
      evidenceIdExists(evidence, `github-${candidate.id}`, "repository"))
    .slice(0, 6)
    .map((candidate) =>
      scoreCandidate({
        candidate,
        evidence,
        ciResult,
        logResult,
        databaseResult,
        confidenceCeiling,
        missingSources,
      }),
    )
    .sort((a, b) => b.confidence - a.confidence);

  const winner = candidates[0];
  const runnerUp = candidates[1];
  const separation = winner && runnerUp
    ? winner.confidence - runnerUp.confidence
    : winner
      ? winner.confidence
      : 0;

  const promotable =
    Boolean(winner) &&
    winner!.confidence >= 0.55 &&
    winner!.supportingEvidenceIds.length >= 2 &&
    separation >= 0.05;

  const simulated = evidence.some((item) => item.metadata?.simulated === true);
  const statement = promotable && winner
    ? `${simulated ? "In the simulated scenario, " : ""}${winner.title} is the leading incident trigger candidate, supported by cross-agent evidence.`
    : "No root-cause candidate has enough independent corroboration yet.";

  const hypothesisConfidence = promotable && winner
    ? winner.confidence
    : Math.min(winner?.confidence ?? 0, confidenceCeiling, 0.49);

  const contradictions = [...(winner?.contradictions ?? [])];
  if (runnerUp && separation < 0.10) {
    contradictions.push(
      `Competing candidate remains close: ${runnerUp.title} (${Math.round(runnerUp.confidence * 100)}% confidence).`,
    );
  }

  const missingEvidence = [
    ...(winner?.missingEvidence ?? missingSources.map(
      (source) => `${source} evidence is unavailable or unconfigured.`,
    )),
  ];

  if (!promotable && candidates.length > 0 && availableSources.length >= 2) {
    missingEvidence.push(
      "Evidence agreement or candidate separation is insufficient for promotion.",
    );
  }

  if (candidates.length === 0) {
    missingEvidence.push(
      "Repository Agent did not identify a candidate above the minimum correlation threshold.",
    );
  }
  if (evidence.some((item) => item.freshness !== "fresh")) {
    missingEvidence.push("Refresh stale or unknown evidence before increasing confidence.");
  }
  if (simulated) missingEvidence.push("Replace simulated signals with live evidence before making a production diagnosis.");

  const packet = buildReasoningPacket({
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      createdAt: incident.createdAt,
      service: incident.service,
    },
    evidence,
    hypothesis: {
      statement,
      confidence: hypothesisConfidence,
      evidenceIds: promotable ? winner!.supportingEvidenceIds : [],
      contradictions,
      missingEvidence,
    },
    actions: buildActions(promotable ? winner : undefined),
  });

  packet.confidenceCeiling = confidenceCeiling;
  packet.audit.push({
    actor: "reasoning-agent",
    action: promotable
      ? "root-cause-candidate-promoted"
      : "insufficient-evidence",
    timestamp: packet.generatedAt,
    evidenceIds: packet.hypothesis.evidenceIds,
    metadata: {
      availableSources,
      missingSources,
      winner: winner?.candidateId ?? null,
      confidence: packet.hypothesis.confidence,
      confidenceCeiling: packet.confidenceCeiling,
      candidateSeparation: separation,
      simulated,
      contradictingEvidenceIds: winner?.contradictingEvidenceIds ?? [],
    },
  });

  const summary = promotable && winner
    ? `Promoted ${winner.title} as the leading hypothesis at ${Math.round(packet.hypothesis.confidence * 100)}% confidence using ${availableSources.length}/4 evidence sources.`
    : `No candidate met the promotion threshold. ${availableSources.length}/4 evidence sources are currently available.`;

  return {
    status: promotable ? "complete" : "insufficient-evidence",
    summary,
    candidates,
    winningCandidate: promotable ? winner : undefined,
    packet,
    availableSources,
    missingSources,
  };
}
