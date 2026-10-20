import type { Evidence } from "@devrelay/core";
import {
  GitHubActionsProvider,
  GitHubApiError,
  type GitHubWorkflowRunSummary,
} from "@devrelay/integrations";
import type { StoredIncident } from "./incident-store";
import type { RepositoryAgentResult, RepositoryCandidate } from "./repository-agent";

export type CiSignal = "supports" | "contradicts" | "neutral";

export interface CiCandidateFinding {
  candidateId: string;
  candidateTitle: string;
  candidateSha: string;
  signal: CiSignal;
  summary: string;
  matchedRuns: Array<{
    id: number;
    name: string;
    conclusion: string | null;
    event: string;
    htmlUrl: string;
    failedJobs: string[];
    failedSteps: string[];
    validationCategories: string[];
    missingValidationCategories: string[];
  }>;
}

export interface CiAgentResult {
  status: "complete" | "error";
  repository: string;
  summary: string;
  findings: CiCandidateFinding[];
  evidence: Evidence[];
  inspectedRuns: number;
  fetchedAt?: string;
  error?: string;
}

const VALIDATION_PATTERNS: Record<string, RegExp[]> = {
  build: [/\bbuild\b/i, /compile/i],
  unit: [/unit/i, /jest/i, /vitest/i, /pytest/i, /mocha/i],
  integration: [/integration/i, /e2e/i, /end[- ]to[- ]end/i, /playwright/i, /cypress/i],
  lint: [/lint/i, /eslint/i],
  typecheck: [/type[- ]?check/i, /tsc/i, /mypy/i],
  security: [/security/i, /sast/i, /codeql/i, /dependency[- ]?check/i, /audit/i],
  performance: [/performance/i, /load[- ]?test/i, /stress/i, /benchmark/i, /k6/i, /locust/i],
};

const EXPECTED_CATEGORIES = [
  "build",
  "unit",
  "integration",
  "lint",
  "typecheck",
  "security",
  "performance",
];

function collectValidationCategories(run: GitHubWorkflowRunSummary): string[] {
  const haystack = [
    run.name,
    ...run.jobs.map((job) => job.name),
    ...run.jobs.flatMap((job) => job.steps.map((step) => step.name)),
  ].join(" ");

  return EXPECTED_CATEGORIES.filter((category) =>
    VALIDATION_PATTERNS[category]?.some((pattern) => pattern.test(haystack)),
  );
}

function matchRunsToCandidate(
  candidate: RepositoryCandidate,
  runs: GitHubWorkflowRunSummary[],
): GitHubWorkflowRunSummary[] {
  return runs.filter((run) => run.headSha === candidate.sha);
}

function classifyRunSet(
  runs: GitHubWorkflowRunSummary[],
  candidate: RepositoryCandidate,
): {
  signal: CiSignal;
  summary: string;
} {
  if (runs.length === 0) {
    return {
      signal: "neutral",
      summary: `No GitHub Actions workflow run was found for ${candidate.sha.slice(0, 7)}.`,
    };
  }

  const failed = runs.filter((run) => run.conclusion === "failure");
  const passed = runs.filter((run) => run.conclusion === "success");
  const incomplete = runs.filter(
    (run) => run.status !== "completed" || !run.conclusion,
  );

  if (failed.length > 0) {
    return {
      signal: "supports",
      summary: `${failed.length} matched workflow run(s) failed for this change, increasing suspicion.`,
    };
  }

  if (passed.length > 0) {
    const categories = new Set(
      passed.flatMap((run) => collectValidationCategories(run)),
    );
    const missing = EXPECTED_CATEGORIES.filter((item) => !categories.has(item));

    if (missing.includes("integration") || missing.includes("performance")) {
      return {
        signal: "neutral",
        summary:
          `CI passed for this change, but coverage appears incomplete. Missing detected validation: ${missing.join(", ")}.`,
      };
    }

    return {
      signal: "contradicts",
      summary:
        "Matched CI runs passed with broad validation coverage, which weakens the code-change hypothesis.",
    };
  }

  if (incomplete.length > 0) {
    return {
      signal: "neutral",
      summary: "Matched CI exists but has not completed, so it cannot yet support or contradict the hypothesis.",
    };
  }

  return {
    signal: "neutral",
    summary: "Matched CI evidence is inconclusive.",
  };
}

function findingToEvidence(
  finding: CiCandidateFinding,
  repository: string,
  observedAt: string,
): Evidence {
  return {
    id: `ci-${finding.candidateId}`,
    source: `github-actions:${repository}`,
    kind: "ci",
    summary: `${finding.candidateTitle}: ${finding.summary}`,
    observedAt,
    freshness: "fresh",
    uri: finding.matchedRuns[0]?.htmlUrl,
    metadata: {
      signal: finding.signal,
      candidateSha: finding.candidateSha,
      runs: finding.matchedRuns,
    },
  };
}

export async function runCiAgent(
  incident: StoredIncident,
  repositoryResult: RepositoryAgentResult,
): Promise<CiAgentResult> {
  if (!incident.repository) {
    return {
      status: "error",
      repository: "",
      summary: "No repository is configured for CI inspection.",
      findings: [],
      evidence: [],
      inspectedRuns: 0,
      error: "Repository is missing.",
    };
  }

  const provider = new GitHubActionsProvider(process.env.GITHUB_TOKEN);

  try {
    const snapshot = await provider.inspect(incident.repository, { maxRuns: 30 });

    const candidates = repositoryResult.candidates
      .filter((candidate) => candidate.score >= 20)
      .slice(0, 6);

    const findings = candidates.map((candidate): CiCandidateFinding => {
      const runs = matchRunsToCandidate(candidate, snapshot.runs);
      const classification = classifyRunSet(runs, candidate);

      return {
        candidateId: candidate.id,
        candidateTitle: candidate.title,
        candidateSha: candidate.sha,
        signal: classification.signal,
        summary: classification.summary,
        matchedRuns: runs.map((run) => {
          const validationCategories = collectValidationCategories(run);
          const missingValidationCategories = EXPECTED_CATEGORIES.filter(
            (item) => !validationCategories.includes(item),
          );

          return {
            id: run.id,
            name: run.name,
            conclusion: run.conclusion,
            event: run.event,
            htmlUrl: run.htmlUrl,
            failedJobs: run.jobs
              .filter((job) => job.conclusion === "failure")
              .map((job) => job.name),
            failedSteps: run.jobs.flatMap((job) =>
              job.steps
                .filter((step) => step.conclusion === "failure")
                .map((step) => `${job.name}: ${step.name}`),
            ),
            validationCategories,
            missingValidationCategories,
          };
        }),
      };
    });

    const supporting = findings.filter((item) => item.signal === "supports").length;
    const contradicting = findings.filter(
      (item) => item.signal === "contradicts",
    ).length;

    const summary =
      findings.length === 0
        ? `Inspected ${snapshot.runs.length} workflow runs, but no repository candidate had enough correlation to evaluate.`
        : `Inspected ${snapshot.runs.length} workflow runs across ${findings.length} repository candidate(s): ${supporting} supporting, ${contradicting} contradicting, ${findings.length - supporting - contradicting} neutral.`;

    const observedAt = snapshot.fetchedAt;

    return {
      status: "complete",
      repository: snapshot.repository,
      summary,
      findings,
      evidence: findings
        .filter((finding) => finding.matchedRuns.length > 0)
        .map((finding) => findingToEvidence(finding, snapshot.repository, observedAt)),
      inspectedRuns: snapshot.runs.length,
      fetchedAt: snapshot.fetchedAt,
    };
  } catch (error) {
    const message =
      error instanceof GitHubApiError
        ? `${error.message}${error.status === 403 ? " Add GITHUB_TOKEN for higher rate limits or private workflow data." : ""}`
        : error instanceof Error
          ? error.message
          : "Unknown GitHub Actions provider error.";

    return {
      status: "error",
      repository: incident.repository,
      summary: "CI Agent could not inspect GitHub Actions.",
      findings: [],
      evidence: [],
      inspectedRuns: 0,
      error: message,
    };
  }
}
