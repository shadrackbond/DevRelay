import type { Evidence } from "@devrelay/core";
import type { CiAgentResult } from "../app/lib/ci-agent";
import type { DatabaseAgentResult } from "../app/lib/database-agent";
import type { StoredIncident } from "../app/lib/incident-store";
import type { LogAgentResult } from "../app/lib/log-agent";
import type {
  RepositoryAgentResult,
  RepositoryCandidate,
} from "../app/lib/repository-agent";
import type { BenchmarkCase } from "./harness";

const T0 = "2026-10-20T08:00:00.000Z";

function incident(
  id: string,
  title: string,
  description: string,
  service: string,
): StoredIncident {
  return {
    id,
    title,
    description,
    service,
    repository: "shadrackbond/DevRelay",
    severity: "high",
    status: "investigating",
    createdAt: T0,
    updatedAt: T0,
  };
}

function candidate(
  id: string,
  title: string,
  score: number,
): RepositoryCandidate {
  return {
    id,
    type: "commit",
    title,
    url: `https://github.com/example/repo/commit/${id}`,
    sha: id.padEnd(40, "a").slice(0, 40),
    occurredAt: "2026-10-20T07:30:00.000Z",
    score,
    reasons: ["Changed within incident window."],
    files: ["src/service.ts"],
  };
}

function ev(id: string, kind: Evidence["kind"], summary: string): Evidence {
  return {
    id,
    source: `benchmark:${kind}`,
    kind,
    summary,
    observedAt: T0,
    freshness: "fresh",
  };
}

function repoResult(candidates: RepositoryCandidate[]): RepositoryAgentResult {
  return {
    status: "complete",
    repository: "example/repo",
    summary: "Benchmark repository evidence.",
    candidates,
    evidence: candidates.map((item) =>
      ev(`github-${item.id}`, "repository", item.title),
    ),
    inspected: { commits: candidates.length, pullRequests: 0 },
    fetchedAt: T0,
  };
}

function ciResult(
  rows: Array<{ candidate: RepositoryCandidate; signal: "supports" | "contradicts" | "neutral" }>,
  complete = true,
): CiAgentResult {
  if (!complete) {
    return {
      status: "error",
      repository: "example/repo",
      summary: "CI unavailable.",
      findings: [],
      evidence: [],
      inspectedRuns: 0,
      error: "benchmark unavailable",
    };
  }

  return {
    status: "complete",
    repository: "example/repo",
    summary: "Benchmark CI evidence.",
    inspectedRuns: rows.length,
    findings: rows.map(({ candidate, signal }, index) => ({
      candidateId: candidate.id,
      candidateTitle: candidate.title,
      candidateSha: candidate.sha,
      signal,
      summary:
        signal === "supports"
          ? "Matched workflow failed for this change."
          : signal === "contradicts"
            ? "Matched CI passed with broad validation."
            : "CI is inconclusive.",
      matchedRuns: [
        {
          id: index + 1,
          name: "CI",
          conclusion: signal === "supports" ? "failure" : "success",
          event: "push",
          htmlUrl: "https://github.com/example/repo/actions",
          failedJobs: signal === "supports" ? ["validate"] : [],
          failedSteps: signal === "supports" ? ["validate: test"] : [],
          validationCategories: ["build", "unit", "typecheck"],
          missingValidationCategories: ["integration", "performance"],
        },
      ],
    })),
    evidence: rows.map(({ candidate, signal }) =>
      ev(
        `ci-${candidate.id}`,
        "ci",
        `${candidate.title}: ${signal}`,
      ),
    ),
    fetchedAt: T0,
  };
}

function logResult(
  rows: Array<{
    candidate: RepositoryCandidate;
    signal: "supports" | "contradicts" | "neutral";
    score: number;
  }>,
  complete = true,
): LogAgentResult {
  if (!complete) {
    return {
      status: "unconfigured",
      source: "",
      summary: "Logs unavailable.",
      entriesInspected: 0,
      signatures: [],
      findings: [],
      evidence: [],
      error: "benchmark unavailable",
    };
  }

  return {
    status: "complete",
    source: "benchmark-logs",
    summary: "Benchmark runtime evidence.",
    entriesInspected: 100,
    signatures: [],
    findings: rows.map(({ candidate, signal, score }) => ({
      candidateId: candidate.id,
      candidateTitle: candidate.title,
      signal,
      supportScore: score,
      summary:
        signal === "supports"
          ? "Runtime failures align with this change."
          : signal === "contradicts"
            ? "Failures predate this change."
            : "Runtime evidence is inconclusive.",
      relatedSignatures: [],
      reasons:
        signal === "supports"
          ? ["Runtime signature appeared after the change."]
          : signal === "contradicts"
            ? ["Runtime signature existed before the change."]
            : [],
    })),
    evidence: rows.map(({ candidate, signal }) =>
      ev(
        `logs-${candidate.id}`,
        "logs",
        `${candidate.title}: ${signal}`,
      ),
    ),
    fetchedAt: T0,
  };
}

function databaseResult(
  rows: Array<{
    candidate: RepositoryCandidate;
    signal: "supports" | "contradicts" | "neutral";
    score: number;
  }>,
  complete = true,
): DatabaseAgentResult {
  if (!complete) {
    return {
      status: "unconfigured",
      source: "",
      summary: "Database unavailable.",
      findings: [],
      evidence: [],
      error: "benchmark unavailable",
    };
  }

  return {
    status: "complete",
    source: "benchmark-db",
    summary: "Benchmark database evidence.",
    snapshot: {
      provider: "postgresql",
      database: "benchmark",
      capturedAt: T0,
      connections: {
        active: 95,
        idle: 5,
        waiting: 20,
        max: 100,
        utilizationPercent: 95,
      },
      queries: { longRunning: 2, longestSeconds: 30 },
      locks: { blockedSessions: 0, blockingSessions: 0 },
      waits: [],
    },
    findings: rows.map(({ candidate, signal, score }) => ({
      candidateId: candidate.id,
      candidateTitle: candidate.title,
      signal,
      supportScore: score,
      summary:
        signal === "supports"
          ? "Database pressure aligns with this candidate."
          : signal === "contradicts"
            ? "Database health is normal."
            : "Database telemetry is inconclusive.",
      reasons:
        signal === "supports"
          ? ["Connection utilization is elevated."]
          : [],
    })),
    evidence: rows.map(({ candidate, signal }) =>
      ev(
        `database-${candidate.id}`,
        "database",
        `${candidate.title}: ${signal}`,
      ),
    ),
  };
}

function benchmark(input: {
  id: string;
  name: string;
  category: string;
  root: RepositoryCandidate | null;
  candidates: RepositoryCandidate[];
  ci: Array<{ candidate: RepositoryCandidate; signal: "supports" | "contradicts" | "neutral" }>;
  logs: Array<{ candidate: RepositoryCandidate; signal: "supports" | "contradicts" | "neutral"; score: number }>;
  db: Array<{ candidate: RepositoryCandidate; signal: "supports" | "contradicts" | "neutral"; score: number }>;
  ciAvailable?: boolean;
  logsAvailable?: boolean;
  dbAvailable?: boolean;
  shouldAbstain?: boolean;
  requiresApproval?: boolean;
}): BenchmarkCase {
  const repo = repoResult(input.candidates);
  const ci = ciResult(input.ci, input.ciAvailable ?? true);
  const logs = logResult(input.logs, input.logsAvailable ?? true);
  const db = databaseResult(input.db, input.dbAvailable ?? true);

  const relevantEvidenceIds = input.root
    ? [
        `github-${input.root.id}`,
        ...(input.ci.some((row) => row.candidate.id === input.root?.id)
          ? [`ci-${input.root.id}`]
          : []),
        ...(input.logs.some((row) => row.candidate.id === input.root?.id)
          ? [`logs-${input.root.id}`]
          : []),
        ...(input.db.some((row) => row.candidate.id === input.root?.id)
          ? [`database-${input.root.id}`]
          : []),
      ]
    : [];

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    incident: incident(
      input.id,
      input.name,
      `Synthetic benchmark for ${input.category}.`,
      "checkout-service",
    ),
    repositoryResult: repo,
    ciResult: ci,
    logResult: logs,
    databaseResult: db,
    groundTruth: {
      rootCauseCandidateId: input.root?.id ?? null,
      shouldAbstain: input.shouldAbstain ?? false,
      relevantEvidenceIds,
      requiresHumanApproval: input.requiresApproval ?? false,
    },
  };
}

const dbPool = candidate("c-db-pool", "Increase checkout worker concurrency", 82);
const cssChange = candidate("c-css", "Update dashboard colors", 35);
const migration = candidate("c-migration", "Add blocking orders migration", 78);
const retry = candidate("c-retry", "Increase API retry fanout", 74);
const auth = candidate("c-auth", "Rotate authentication middleware", 70);
const oldBug = candidate("c-old", "Refactor legacy parser", 66);
const docs = candidate("c-docs", "Documentation update", 25);

export const BENCHMARK_CASES: BenchmarkCase[] = [
  benchmark({
    id: "BENCH-001",
    name: "Database pool exhaustion after concurrency increase",
    category: "database-regression",
    root: dbPool,
    candidates: [dbPool, cssChange],
    ci: [
      { candidate: dbPool, signal: "neutral" },
      { candidate: cssChange, signal: "contradicts" },
    ],
    logs: [
      { candidate: dbPool, signal: "supports", score: 90 },
      { candidate: cssChange, signal: "neutral", score: 20 },
    ],
    db: [
      { candidate: dbPool, signal: "supports", score: 92 },
      { candidate: cssChange, signal: "neutral", score: 25 },
    ],
    requiresApproval: true,
  }),
  benchmark({
    id: "BENCH-002",
    name: "Blocking migration causes request stalls",
    category: "database-locking",
    root: migration,
    candidates: [migration, docs],
    ci: [
      { candidate: migration, signal: "neutral" },
      { candidate: docs, signal: "contradicts" },
    ],
    logs: [
      { candidate: migration, signal: "supports", score: 82 },
      { candidate: docs, signal: "neutral", score: 10 },
    ],
    db: [
      { candidate: migration, signal: "supports", score: 94 },
      { candidate: docs, signal: "neutral", score: 15 },
    ],
    requiresApproval: true,
  }),
  benchmark({
    id: "BENCH-003",
    name: "Retry fanout amplifies upstream failures",
    category: "runtime-regression",
    root: retry,
    candidates: [retry, cssChange],
    ci: [
      { candidate: retry, signal: "neutral" },
      { candidate: cssChange, signal: "neutral" },
    ],
    logs: [
      { candidate: retry, signal: "supports", score: 91 },
      { candidate: cssChange, signal: "neutral", score: 18 },
    ],
    db: [
      { candidate: retry, signal: "neutral", score: 35 },
      { candidate: cssChange, signal: "neutral", score: 20 },
    ],
    requiresApproval: false,
  }),
  benchmark({
    id: "BENCH-004",
    name: "Green CI with production-only auth regression",
    category: "ci-gap",
    root: auth,
    candidates: [auth, docs],
    ci: [
      { candidate: auth, signal: "neutral" },
      { candidate: docs, signal: "contradicts" },
    ],
    logs: [
      { candidate: auth, signal: "supports", score: 84 },
      { candidate: docs, signal: "neutral", score: 15 },
    ],
    db: [
      { candidate: auth, signal: "neutral", score: 30 },
      { candidate: docs, signal: "neutral", score: 20 },
    ],
    requiresApproval: false,
  }),
  benchmark({
    id: "BENCH-005",
    name: "Pre-existing errors should weaken recent change",
    category: "contradiction",
    root: null,
    candidates: [oldBug, cssChange],
    ci: [
      { candidate: oldBug, signal: "neutral" },
      { candidate: cssChange, signal: "neutral" },
    ],
    logs: [
      { candidate: oldBug, signal: "contradicts", score: 20 },
      { candidate: cssChange, signal: "neutral", score: 15 },
    ],
    db: [
      { candidate: oldBug, signal: "contradicts", score: 15 },
      { candidate: cssChange, signal: "neutral", score: 20 },
    ],
    shouldAbstain: true,
  }),
  benchmark({
    id: "BENCH-006",
    name: "External dependency outage with no code cause",
    category: "external-dependency",
    root: null,
    candidates: [cssChange, docs],
    ci: [
      { candidate: cssChange, signal: "contradicts" },
      { candidate: docs, signal: "contradicts" },
    ],
    logs: [
      { candidate: cssChange, signal: "neutral", score: 10 },
      { candidate: docs, signal: "neutral", score: 10 },
    ],
    db: [
      { candidate: cssChange, signal: "contradicts", score: 10 },
      { candidate: docs, signal: "contradicts", score: 10 },
    ],
    shouldAbstain: true,
  }),
  benchmark({
    id: "BENCH-007",
    name: "Only repository evidence available",
    category: "insufficient-evidence",
    root: dbPool,
    candidates: [dbPool, cssChange],
    ci: [],
    logs: [],
    db: [],
    ciAvailable: false,
    logsAvailable: false,
    dbAvailable: false,
    shouldAbstain: true,
  }),
  benchmark({
    id: "BENCH-008",
    name: "Repository plus CI without runtime proof",
    category: "insufficient-evidence",
    root: retry,
    candidates: [retry, docs],
    ci: [
      { candidate: retry, signal: "supports" },
      { candidate: docs, signal: "neutral" },
    ],
    logs: [],
    db: [],
    logsAvailable: false,
    dbAvailable: false,
    shouldAbstain: false,
  }),
];
