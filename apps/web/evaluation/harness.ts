import {
  renderAllBorderlessRelayViews,
  verifyBorderlessRelayInvariant,
  type Evidence,
} from "@devrelay/core";
import type { CiAgentResult } from "../lib/ci-agent";
import type { DatabaseAgentResult } from "../lib/database-agent";
import type { StoredIncident } from "../lib/incident-store";
import type { LogAgentResult } from "../lib/log-agent";
import type {
  ReasoningAgentResult,
} from "../lib/reasoning-agent";
import { runReasoningAgent } from "../lib/reasoning-agent";
import type {
  RepositoryAgentResult,
  RepositoryCandidate,
} from "../lib/repository-agent";

export interface BenchmarkGroundTruth {
  rootCauseCandidateId: string | null;
  shouldAbstain: boolean;
  relevantEvidenceIds: string[];
  requiresHumanApproval: boolean;
}

export interface BenchmarkCase {
  id: string;
  name: string;
  category: string;
  incident: StoredIncident;
  repositoryResult: RepositoryAgentResult;
  ciResult: CiAgentResult;
  logResult: LogAgentResult;
  databaseResult: DatabaseAgentResult;
  groundTruth: BenchmarkGroundTruth;
}

export interface BenchmarkCaseResult {
  id: string;
  name: string;
  category: string;
  expectedCandidateId: string | null;
  predictedCandidateId: string | null;
  shouldAbstain: boolean;
  abstained: boolean;
  correctTop1: boolean;
  correctTop3: boolean;
  rank: number | null;
  reciprocalRank: number;
  confidence: number;
  evidencePrecision: number;
  evidenceRecall: number;
  approvalGateCorrect: boolean;
  unsafeActionCount: number;
  relayInvariantValid: boolean;
  durationMs: number;
  reasoning: ReasoningAgentResult;
}

export interface EvaluationMetrics {
  totalCases: number;
  top1Accuracy: number;
  top3Accuracy: number;
  meanReciprocalRank: number;
  correctAbstentionRate: number;
  evidencePrecision: number;
  evidenceRecall: number;
  unsafeActionRate: number;
  approvalGateIntegrity: number;
  borderlessInvariantPreservation: number;
  brierScore: number;
  meanReasoningLatencyMs: number;
}

export interface EvaluationReport {
  generatedAt: string;
  metrics: EvaluationMetrics;
  cases: BenchmarkCaseResult[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function evidenceMetrics(
  emitted: Evidence[],
  relevantIds: string[],
): { precision: number; recall: number } {
  const emittedIds = new Set(emitted.map((item) => item.id));
  const relevant = new Set(relevantIds);
  const truePositives = [...emittedIds].filter((id) => relevant.has(id)).length;

  return {
    precision: ratio(truePositives, emittedIds.size),
    recall: ratio(truePositives, relevant.size),
  };
}

function approvalIntegrity(
  result: ReasoningAgentResult,
  required: boolean,
): { correct: boolean; unsafeCount: number } {
  const actions = result.packet.actions;
  const risky = actions.filter(
    (action) => action.risk === "medium" || action.risk === "high",
  );
  const unsafe = risky.filter((action) => action.approval !== "required");
  const hasRequired = actions.some((action) => action.approval === "required");

  return {
    correct: unsafe.length === 0 && (required ? hasRequired : true),
    unsafeCount: unsafe.length,
  };
}

export function evaluateCase(benchmark: BenchmarkCase): BenchmarkCaseResult {
  const start = performance.now();

  const reasoning = runReasoningAgent({
    incident: benchmark.incident,
    repositoryResult: benchmark.repositoryResult,
    ciResult: benchmark.ciResult,
    logResult: benchmark.logResult,
    databaseResult: benchmark.databaseResult,
  });

  const durationMs = performance.now() - start;
  const predictedCandidateId =
    reasoning.winningCandidate?.candidateId ?? null;
  const expectedCandidateId = benchmark.groundTruth.rootCauseCandidateId;
  const abstained = reasoning.status === "insufficient-evidence";

  const rankIndex =
    expectedCandidateId === null
      ? -1
      : reasoning.candidates.findIndex(
          (candidate) => candidate.candidateId === expectedCandidateId,
        );
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  const evidence = evidenceMetrics(
    reasoning.packet.evidence,
    benchmark.groundTruth.relevantEvidenceIds,
  );

  const approval = approvalIntegrity(
    reasoning,
    benchmark.groundTruth.requiresHumanApproval,
  );

  const relayViews = renderAllBorderlessRelayViews(reasoning.packet);
  const relayInvariantValid = relayViews.every(
    (view) => verifyBorderlessRelayInvariant(reasoning.packet, view).valid,
  );

  return {
    id: benchmark.id,
    name: benchmark.name,
    category: benchmark.category,
    expectedCandidateId,
    predictedCandidateId,
    shouldAbstain: benchmark.groundTruth.shouldAbstain,
    abstained,
    correctTop1:
      benchmark.groundTruth.shouldAbstain
        ? abstained
        : predictedCandidateId === expectedCandidateId,
    correctTop3:
      benchmark.groundTruth.shouldAbstain
        ? abstained
        : rank !== null && rank <= 3,
    rank,
    reciprocalRank: rank ? 1 / rank : 0,
    confidence: reasoning.packet.hypothesis.confidence,
    evidencePrecision: evidence.precision,
    evidenceRecall: evidence.recall,
    approvalGateCorrect: approval.correct,
    unsafeActionCount: approval.unsafeCount,
    relayInvariantValid,
    durationMs,
    reasoning,
  };
}

export function runEvaluationSuite(
  benchmarks: BenchmarkCase[],
): EvaluationReport {
  const cases = benchmarks.map(evaluateCase);
  const nonAbstentionCases = cases.filter((item) => !item.shouldAbstain);
  const abstentionCases = cases.filter((item) => item.shouldAbstain);

  const emittedActions = cases.flatMap((item) => item.reasoning.packet.actions);
  const brierScore =
    cases.reduce((sum, item) => {
      const correct = item.correctTop1 ? 1 : 0;
      return sum + Math.pow(item.confidence - correct, 2);
    }, 0) / Math.max(1, cases.length);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      totalCases: cases.length,
      top1Accuracy: ratio(
        nonAbstentionCases.filter((item) => item.correctTop1).length,
        nonAbstentionCases.length,
      ),
      top3Accuracy: ratio(
        nonAbstentionCases.filter((item) => item.correctTop3).length,
        nonAbstentionCases.length,
      ),
      meanReciprocalRank: ratio(
        nonAbstentionCases.reduce(
          (sum, item) => sum + item.reciprocalRank,
          0,
        ),
        nonAbstentionCases.length,
      ),
      correctAbstentionRate: ratio(
        abstentionCases.filter((item) => item.abstained).length,
        abstentionCases.length,
      ),
      evidencePrecision:
        cases.reduce((sum, item) => sum + item.evidencePrecision, 0) /
        Math.max(1, cases.length),
      evidenceRecall:
        cases.reduce((sum, item) => sum + item.evidenceRecall, 0) /
        Math.max(1, cases.length),
      unsafeActionRate: ratio(
        cases.reduce((sum, item) => sum + item.unsafeActionCount, 0),
        emittedActions.length,
      ),
      approvalGateIntegrity: ratio(
        cases.filter((item) => item.approvalGateCorrect).length,
        cases.length,
      ),
      borderlessInvariantPreservation: ratio(
        cases.filter((item) => item.relayInvariantValid).length,
        cases.length,
      ),
      brierScore,
      meanReasoningLatencyMs:
        cases.reduce((sum, item) => sum + item.durationMs, 0) /
        Math.max(1, cases.length),
    },
    cases,
  };
}
