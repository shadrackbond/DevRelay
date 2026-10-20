import type { Evidence } from "@devrelay/core";
import {
  GitHubApiError,
  GitHubRepositoryProvider,
  type GitHubCommitSummary,
  type GitHubPullRequestSummary,
} from "@devrelay/integrations";
import type { StoredIncident } from "./incident-store";

export interface RepositoryCandidate {
  id: string;
  type: "commit" | "pull-request";
  title: string;
  url: string;
  occurredAt: string | null;
  score: number;
  reasons: string[];
  files: string[];
}

export interface RepositoryAgentResult {
  status: "complete" | "error";
  repository: string;
  summary: string;
  candidates: RepositoryCandidate[];
  evidence: Evidence[];
  inspected: {
    commits: number;
    pullRequests: number;
  };
  fetchedAt?: string;
  error?: string;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "are", "was", "were",
  "have", "has", "into", "when", "what", "your", "service", "issue", "error",
  "incident", "production", "user", "users", "using", "not", "but", "our",
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.\/-]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function overlapScore(incidentTokens: Set<string>, text: string): {
  points: number;
  matches: string[];
} {
  const candidateTokens = tokens(text);
  const matches = [...incidentTokens].filter((token) =>
    [...candidateTokens].some(
      (candidate) =>
        candidate === token ||
        candidate.includes(token) ||
        token.includes(candidate),
    ),
  );

  return {
    points: Math.min(matches.length * 12, 48),
    matches: matches.slice(0, 5),
  };
}

function temporalScore(occurredAt: string | null, incidentAt: string): {
  points: number;
  reason?: string;
} {
  if (!occurredAt) return { points: 0 };

  const incidentTime = new Date(incidentAt).getTime();
  const changeTime = new Date(occurredAt).getTime();
  const deltaHours = (incidentTime - changeTime) / 3_600_000;

  if (deltaHours < -0.25) {
    return { points: 0, reason: "Occurred after incident intake; retained as context, not causal evidence." };
  }

  if (deltaHours <= 6) {
    return { points: 35, reason: "Changed within 6 hours of incident intake." };
  }
  if (deltaHours <= 24) {
    return { points: 25, reason: "Changed within 24 hours of incident intake." };
  }
  if (deltaHours <= 72) {
    return { points: 15, reason: "Changed within 3 days of incident intake." };
  }
  if (deltaHours <= 168) {
    return { points: 8, reason: "Changed within 7 days of incident intake." };
  }

  return { points: 0 };
}

function serviceScore(service: string, files: string[], text: string): {
  points: number;
  reason?: string;
} {
  const normalized = service.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length < 3) return { points: 0 };

  const haystack = [text, ...files].join(" ").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (haystack.includes(normalized)) {
    return { points: 17, reason: `Touches or references ${service}.` };
  }

  const serviceTerms = service
    .toLowerCase()
    .split(/[-_./\s]+/)
    .filter((term) => term.length >= 3);

  if (serviceTerms.some((term) => haystack.includes(term))) {
    return { points: 9, reason: "Touches files or text related to the affected service." };
  }

  return { points: 0 };
}

function rankCommit(
  commit: GitHubCommitSummary,
  incident: StoredIncident,
  incidentTokens: Set<string>,
): RepositoryCandidate {
  const lexical = overlapScore(incidentTokens, commit.message);
  const temporal = temporalScore(commit.date, incident.createdAt);
  const service = serviceScore(incident.service, [], commit.message);
  const reasons: string[] = [];

  if (temporal.reason) reasons.push(temporal.reason);
  if (lexical.matches.length) {
    reasons.push(`Shares incident terms: ${lexical.matches.join(", ")}.`);
  }
  if (service.reason) reasons.push(service.reason);
  if (!reasons.length) reasons.push("Recent repository change with no strong incident correlation yet.");

  return {
    id: `commit-${commit.sha}`,
    type: "commit",
    title: commit.message.split("\n")[0].slice(0, 120),
    url: commit.htmlUrl,
    occurredAt: commit.date,
    score: Math.min(100, lexical.points + temporal.points + service.points),
    reasons,
    files: [],
  };
}

function rankPullRequest(
  pull: GitHubPullRequestSummary,
  incident: StoredIncident,
  incidentTokens: Set<string>,
): RepositoryCandidate {
  const text = `${pull.title} ${pull.body}`;
  const lexical = overlapScore(incidentTokens, [text, ...pull.files].join(" "));
  const effectiveTime = pull.mergedAt ?? pull.updatedAt;
  const temporal = temporalScore(effectiveTime, incident.createdAt);
  const service = serviceScore(incident.service, pull.files, text);
  const reasons: string[] = [];

  if (!pull.mergedAt) reasons.push("Pull request is not merged; treated as context rather than a deployed change.");
  if (temporal.reason) reasons.push(temporal.reason);
  if (lexical.matches.length) {
    reasons.push(`Shares incident terms: ${lexical.matches.join(", ")}.`);
  }
  if (service.reason) reasons.push(service.reason);
  if (pull.files.length) reasons.push(`Changed ${pull.files.length} file(s).`);
  if (!reasons.length) reasons.push("Recent pull request with no strong incident correlation yet.");

  return {
    id: `pr-${pull.number}`,
    type: "pull-request",
    title: `PR #${pull.number}: ${pull.title}`,
    url: pull.htmlUrl,
    occurredAt: pull.mergedAt ?? pull.updatedAt,
    score: Math.min(
      100,
      pull.mergedAt
        ? lexical.points + temporal.points + service.points
        : Math.min(19, lexical.points + temporal.points + service.points),
    ),
    reasons,
    files: pull.files.slice(0, 12),
  };
}

function candidateToEvidence(
  candidate: RepositoryCandidate,
  repository: string,
  fetchedAt: string,
): Evidence {
  return {
    id: `github-${candidate.id}`,
    source: `github:${repository}`,
    kind: "repository",
    summary: `${candidate.title} — correlation score ${candidate.score}/100. ${candidate.reasons.join(" ")}`,
    observedAt: candidate.occurredAt ?? fetchedAt,
    freshness: "fresh",
    uri: candidate.url,
    metadata: {
      correlationScore: candidate.score,
      candidateType: candidate.type,
      reasons: candidate.reasons,
      files: candidate.files,
    },
  };
}

export async function runRepositoryAgent(
  incident: StoredIncident,
): Promise<RepositoryAgentResult> {
  if (!incident.repository) {
    return {
      status: "error",
      repository: "",
      summary: "No GitHub repository is attached to this incident.",
      candidates: [],
      evidence: [],
      inspected: { commits: 0, pullRequests: 0 },
      error: "Repository is missing.",
    };
  }

  const provider = new GitHubRepositoryProvider(process.env.GITHUB_TOKEN);
  const since = new Date(
    new Date(incident.createdAt).getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const snapshot = await provider.inspect(incident.repository, {
      since,
      maxCommits: 12,
      maxPullRequests: 8,
    });

    const incidentTokens = tokens(
      `${incident.title} ${incident.description} ${incident.service}`,
    );

    const candidates = [
      ...snapshot.commits.map((commit) =>
        rankCommit(commit, incident, incidentTokens),
      ),
      ...snapshot.pullRequests.map((pull) =>
        rankPullRequest(pull, incident, incidentTokens),
      ),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const strong = candidates.filter((candidate) => candidate.score >= 35);
    const summary =
      strong.length > 0
        ? `Inspected ${snapshot.commits.length} commits and ${snapshot.pullRequests.length} pull requests. Found ${strong.length} repository change(s) with meaningful incident correlation.`
        : `Inspected ${snapshot.commits.length} commits and ${snapshot.pullRequests.length} pull requests. No repository change crossed the correlation threshold, so DevRelay is not asserting a code-change cause.`;

    return {
      status: "complete",
      repository: snapshot.repository.fullName,
      summary,
      candidates,
      evidence: candidates
        .filter((candidate) => candidate.score >= 20)
        .map((candidate) =>
          candidateToEvidence(candidate, snapshot.repository.fullName, snapshot.fetchedAt),
        ),
      inspected: {
        commits: snapshot.commits.length,
        pullRequests: snapshot.pullRequests.length,
      },
      fetchedAt: snapshot.fetchedAt,
    };
  } catch (error) {
    const message =
      error instanceof GitHubApiError
        ? `${error.message}${error.status === 403 ? " Add GITHUB_TOKEN for higher rate limits or private repositories." : ""}`
        : error instanceof Error
          ? error.message
          : "Unknown GitHub provider error.";

    return {
      status: "error",
      repository: incident.repository,
      summary: "Repository Agent could not inspect the configured repository.",
      candidates: [],
      evidence: [],
      inspected: { commits: 0, pullRequests: 0 },
      error: message,
    };
  }
}
