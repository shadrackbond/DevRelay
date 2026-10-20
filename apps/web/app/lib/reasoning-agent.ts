import {
  buildReasoningPacket,
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

function signalScore(signal: string): number {
  if (signal === "supports") return 1;
  if (signal === "contradicts") return 0;
  return 0.5;
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

function evidenceIdExists(evidence: Evidence[], id: string): boolean {
  return evidence.some((item) => item.id === id);
}

function candidateEvidenceIds(
  candidate: RepositoryCandidate,
  evidence: Evidence[],
): string[] {
  return [
    `github-${candidate.id}`,
    `ci-${candidate.id}`,
    `logs-${candidate.id}`,
    `database-${candidate.id}`,
  ].filter((id) => evidenceIdExists(evidence, id));
}

function contradictionIds(
  candidate: RepositoryCandidate,
  evidence: Evidence[],
  ciResult: CiAgentResult,
  logResult: LogAgentResult,
  databaseResult: DatabaseAgentResult,
): string[] {
  const ids: string[] = [];

  const ci = ciResult.findings.find((item) => item.candidateId === candidate.id);
  if (ci?.signal === "contradicts") {
    const id = `ci-${candidate.id}`;
    if (evidenceIdExists(evidence, id)) ids.push(id);
  }

  const logs = logResult.findings.find(
    (item) => item.candidateId === candidate.id,
  );
  if (logs?.signal === "contradicts") {
    const id = `logs-${candidate.id}`;
    if (evidenceIdExists(evidence, id)) ids.push(id);
  }

  const database = databaseResult.findings.find(
    (item) => item.candidateId === candidate.id,
  );
  if (database?.signal === "contradicts") {
    const id = `database-${candidate.id}`;
    if (evidenceIdExists(evidence, id)) ids.push(id);
  }

  return ids;
}

function scoreCandidate(input: {
  candidate: RepositoryCandidate;
  evidence: Evidence[];
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
  availableSources: string[];
  missingSources: string[];
}): CandidateReasoningScore {
  const {
    candidate,
    evidence,
    ciResult,
    logResult,
    databaseResult,
    availableSources,
    missingSources,
  } = input;

  const ci = ciResult.findings.find((item) => item.candidateId === candidate.id);
  const logs = logResult.findings.find(
    (item) => item.candidateId === candidate.id,
  );
  const database = databaseResult.findings.find(
    (item) => item.candidateId === candidate.id,
  );

  const repositoryComponent = candidate.score / 100;
  const ciComponent = ci ? signalScore(ci.signal) : 0.5;
  const logComponent = logs
    ? logs.supportScore / 100
    : logResult.status === "complete"
      ? 0.25
      : 0.5;
  const databaseComponent = database
    ? database.supportScore / 100
    : databaseResult.status === "complete"
      ? 0.25
      : 0.5;

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
  const ceiling = sourceConfidenceCeiling(availableSources.length);

  const confidence = Math.max(
    0,
    Math.min(ceiling, rawScore - contradictionPenalty),
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

  const allEvidenceIds = candidateEvidenceIds(candidate, evidence);
  const contradictory = contradictionIds(
    candidate,
    evidence,
    ciResult,
    logResult,
    databaseResult,
  );
  const supportingEvidenceIds = allEvidenceIds.filter(
    (id) => !contradictory.includes(id),
  );

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
    missingEvidence: missingSources.map(
      (source) => `${source} evidence is unavailable or unconfigured.`,
    ),
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

function collectSourceState(input: {
  repositoryResult: RepositoryAgentResult;
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
}): { availableSources: string[]; missingSources: string[] } {
  const states = [
    ["repository", input.repositoryResult.status === "complete"],
    ["ci", input.ciResult.status === "complete"],
    ["runtime logs", input.logResult.status === "complete"],
    ["database", input.databaseResult.status === "complete"],
  ] as const;

  return {
    availableSources: states
      .filter(([, available]) => available)
      .map(([name]) => name),
    missingSources: states
      .filter(([, available]) => !available)
      .map(([name]) => name),
  };
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

  const evidence = [
    ...repositoryResult.evidence,
    ...ciResult.evidence,
    ...logResult.evidence,
    ...databaseResult.evidence,
  ];

  const { availableSources, missingSources } = collectSourceState(input);

  const candidates = repositoryResult.candidates
    .filter((candidate) => candidate.score >= 20)
    .slice(0, 6)
    .map((candidate) =>
      scoreCandidate({
        candidate,
        evidence,
        ciResult,
        logResult,
        databaseResult,
        availableSources,
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
    availableSources.length >= 2 &&
    separation >= 0.05;

  const statement = promotable && winner
    ? `${winner.title} is the leading incident trigger candidate, supported by cross-agent evidence.`
    : "No root-cause candidate has enough independent corroboration yet.";

  const hypothesisConfidence = promotable && winner
    ? winner.confidence
    : Math.min(winner?.confidence ?? 0.2, 0.49);

  const contradictions = winner?.contradictions ?? [];
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
      evidenceIds: winner?.supportingEvidenceIds ?? [],
      contradictions,
      missingEvidence,
    },
    actions: buildActions(promotable ? winner : undefined),
  });

  packet.confidenceCeiling = Math.min(
    packet.confidenceCeiling,
    sourceConfidenceCeiling(availableSources.length),
  );
  packet.hypothesis.confidence = Math.min(
    packet.hypothesis.confidence,
    packet.confidenceCeiling,
  );
  packet.audit.push({
    actor: "reasoning-agent",
    action: promotable
      ? "root-cause-candidate-promoted"
      : "insufficient-evidence",
    timestamp: new Date().toISOString(),
    evidenceIds: packet.hypothesis.evidenceIds,
    metadata: {
      availableSources,
      missingSources,
      winner: winner?.candidateId ?? null,
      confidence: packet.hypothesis.confidence,
      confidenceCeiling: packet.confidenceCeiling,
      candidateSeparation: separation,
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
