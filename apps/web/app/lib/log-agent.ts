import type { Evidence } from "@devrelay/core";
import {
  HttpRuntimeLogProvider,
  RuntimeLogProviderError,
  SIMULATED_CHECKOUT_SOURCE,
  SimulatedRuntimeLogProvider,
  type RuntimeLogEntry,
} from "@devrelay/integrations";
import type { CiAgentResult } from "./ci-agent";
import type { StoredIncident } from "./incident-store";
import type { RepositoryAgentResult, RepositoryCandidate } from "./repository-agent";

export type LogSignal = "supports" | "contradicts" | "neutral";

export interface LogSignature {
  signature: string;
  count: number;
  level: string;
  firstSeen: string;
  lastSeen: string;
  sample: string;
  traceIds: string[];
}

export interface LogCandidateFinding {
  candidateId: string;
  candidateTitle: string;
  signal: LogSignal;
  supportScore: number;
  summary: string;
  relatedSignatures: LogSignature[];
  reasons: string[];
}

export interface LogAgentResult {
  status: "complete" | "unconfigured" | "error";
  source: string;
  summary: string;
  entriesInspected: number;
  signatures: LogSignature[];
  findings: LogCandidateFinding[];
  evidence: Evidence[];
  fetchedAt?: string;
  error?: string;
}

const GENERIC_WORDS = new Set([
  "error","errors","failed","failure","exception","request","requests","service",
  "production","timeout","timeouts","user","users","http","https","undefined",
  "null","true","false","warn","warning","info","debug","fatal","critical",
]);

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>")
    .replace(/\b[0-9a-f]{7,40}\b/gi, "<sha>")
    .replace(/\b\d{2,}\b/g, "<n>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.\/-]+/g, " ")
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3 && !GENERIC_WORDS.has(part)),
  );
}

function levelWeight(level: string): number {
  if (level === "fatal") return 18;
  if (level === "error") return 14;
  if (level === "warn") return 7;
  return 2;
}

function groupSignatures(entries: RuntimeLogEntry[]): LogSignature[] {
  const groups = new Map<string, RuntimeLogEntry[]>();

  for (const entry of entries) {
    const signature = normalizeMessage(entry.message);
    const current = groups.get(signature) ?? [];
    current.push(entry);
    groups.set(signature, current);
  }

  return [...groups.entries()]
    .map(([signature, items]) => ({
      signature,
      count: items.length,
      level: items
        .map((item) => item.level)
        .sort((a, b) => levelWeight(b) - levelWeight(a))[0] ?? "unknown",
      firstSeen: items[0]?.timestamp ?? "",
      lastSeen: items[items.length - 1]?.timestamp ?? "",
      sample: items[0]?.message ?? signature,
      traceIds: [...new Set(items.map((item) => item.traceId).filter(Boolean) as string[])].slice(0, 8),
    }))
    .sort((a, b) => b.count * levelWeight(b.level) - a.count * levelWeight(a.level));
}

function timingAgainstCandidate(
  firstSeen: string,
  candidate: RepositoryCandidate,
): { points: number; reason?: string } {
  if (!candidate.occurredAt) return { points: 0 };

  const deltaMinutes =
    (new Date(firstSeen).getTime() - new Date(candidate.occurredAt).getTime()) / 60_000;

  if (deltaMinutes >= 0 && deltaMinutes <= 30) {
    return { points: 30, reason: "Runtime signature first appeared within 30 minutes after the change." };
  }
  if (deltaMinutes > 30 && deltaMinutes <= 180) {
    return { points: 22, reason: "Runtime signature first appeared within 3 hours after the change." };
  }
  if (deltaMinutes > 180 && deltaMinutes <= 1440) {
    return { points: 12, reason: "Runtime signature appeared within 24 hours after the change." };
  }
  if (deltaMinutes < 0) {
    return { points: -12, reason: "Runtime signature existed before the candidate change." };
  }

  return { points: 0 };
}

function lexicalRelationship(
  incident: StoredIncident,
  candidate: RepositoryCandidate,
  signature: LogSignature,
): { points: number; matches: string[] } {
  const contextTokens = tokens(
    `${incident.title} ${incident.description} ${incident.service} ${candidate.title} ${candidate.files.join(" ")}`,
  );
  const logTokens = tokens(`${signature.signature} ${signature.sample}`);
  const matches = [...contextTokens].filter((token) =>
    [...logTokens].some(
      (logToken) =>
        token === logToken ||
        token.includes(logToken) ||
        logToken.includes(token),
    ),
  );

  return {
    points: Math.min(matches.length * 8, 32),
    matches: matches.slice(0, 6),
  };
}

function burstPoints(signature: LogSignature): { points: number; reason?: string } {
  const durationMinutes = Math.max(
    1,
    (new Date(signature.lastSeen).getTime() - new Date(signature.firstSeen).getTime()) / 60_000,
  );
  const perMinute = signature.count / durationMinutes;

  if (signature.count >= 100 || perMinute >= 10) {
    return { points: 18, reason: `High-frequency runtime burst: ${signature.count} occurrences.` };
  }
  if (signature.count >= 20 || perMinute >= 2) {
    return { points: 10, reason: `Repeated runtime signature: ${signature.count} occurrences.` };
  }
  if (signature.count >= 5) {
    return { points: 5, reason: `Recurring runtime signature: ${signature.count} occurrences.` };
  }

  return { points: 0 };
}

function candidateFinding(
  incident: StoredIncident,
  candidate: RepositoryCandidate,
  signatures: LogSignature[],
  ciResult: CiAgentResult,
): LogCandidateFinding {
  const scored = signatures.map((signature) => {
    const timing = timingAgainstCandidate(signature.firstSeen, candidate);
    const lexical = lexicalRelationship(incident, candidate, signature);
    const burst = burstPoints(signature);
    const severity = levelWeight(signature.level);

    const points = Math.max(
      0,
      Math.min(100, timing.points + lexical.points + burst.points + severity),
    );

    const reasons = [
      timing.reason,
      lexical.matches.length
        ? `Shares runtime terms: ${lexical.matches.join(", ")}.`
        : undefined,
      burst.reason,
      severity >= 14 ? `Contains ${signature.level}-level runtime failures.` : undefined,
    ].filter((value): value is string => Boolean(value));

    return { signature, points, reasons };
  });

  const related = scored
    .filter((item) => item.points >= 20)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const baseScore = related[0]?.points ?? 0;
  const ciFinding = ciResult.findings.find((item) => item.candidateId === candidate.id);
  const ciAdjustment =
    ciFinding?.signal === "supports" ? 8 :
    ciFinding?.signal === "contradicts" ? -8 :
    0;

  const supportScore = Math.max(0, Math.min(100, baseScore + ciAdjustment));
  const signal: LogSignal =
    supportScore >= 55 ? "supports" :
    related.some((item) => item.reasons.some((reason) => reason.includes("existed before"))) ? "contradicts" :
    "neutral";

  const reasons = related.flatMap((item) => item.reasons).slice(0, 8);

  const summary =
    signal === "supports"
      ? `Runtime logs materially support this repository candidate (${supportScore}/100).`
      : signal === "contradicts"
        ? "Relevant runtime failures predate this candidate, weakening it as the trigger."
        : "Runtime logs do not yet provide strong temporal or semantic support for this candidate.";

  return {
    candidateId: candidate.id,
    candidateTitle: candidate.title,
    signal,
    supportScore,
    summary,
    relatedSignatures: related.map((item) => item.signature),
    reasons,
  };
}

function findingToEvidence(
  finding: LogCandidateFinding,
  source: string,
  fetchedAt: string,
): Evidence {
  const strongest = finding.relatedSignatures[0];

  return {
    id: `logs-${finding.candidateId}`,
    source: `runtime-logs:${source}`,
    kind: "logs",
    summary: `${finding.candidateTitle}: ${finding.summary}`,
    observedAt: strongest?.firstSeen ?? fetchedAt,
    freshness: "fresh",
    metadata: {
      simulated: source === SIMULATED_CHECKOUT_SOURCE,
      signal: finding.signal,
      supportScore: finding.supportScore,
      reasons: finding.reasons,
      signatures: finding.relatedSignatures,
    },
  };
}

export async function runLogAgent(
  incident: StoredIncident,
  repositoryResult: RepositoryAgentResult,
  ciResult: CiAgentResult,
): Promise<LogAgentResult> {
  const sourceUrl = process.env.LOG_SOURCE_URL;

  if (!sourceUrl) {
    return {
      status: "unconfigured",
      source: "",
      summary: "Runtime log provider is not configured.",
      entriesInspected: 0,
      signatures: [],
      findings: [],
      evidence: [],
      error: "Set LOG_SOURCE_URL to a read-only HTTP log endpoint.",
    };
  }

  const simulated = sourceUrl === SIMULATED_CHECKOUT_SOURCE;
  const provider = simulated
    ? new SimulatedRuntimeLogProvider(incident.createdAt)
    : new HttpRuntimeLogProvider(sourceUrl, process.env.LOG_SOURCE_TOKEN);

  try {
    const incidentTime = new Date(incident.createdAt).getTime();
    const from = new Date(incidentTime - 6 * 60 * 60 * 1000).toISOString();
    const to = new Date(incidentTime + 6 * 60 * 60 * 1000).toISOString();
    const snapshot = await provider.query({
      service: incident.service,
      from,
      to,
      limit: simulated ? 2000 : 1000,
    });

    const serviceEntries = snapshot.entries.filter((entry) => {
      if (!entry.service) return true;
      const left = entry.service.toLowerCase();
      const right = incident.service.toLowerCase();
      return left === right || left.includes(right) || right.includes(left);
    });

    const signatures = groupSignatures(serviceEntries);
    const candidates = repositoryResult.candidates
      .filter((candidate) => candidate.score >= 20)
      .slice(0, 6);

    const findings = candidates.map((candidate) =>
      candidateFinding(incident, candidate, signatures, ciResult),
    );

    const supporting = findings.filter((item) => item.signal === "supports").length;
    const contradicting = findings.filter((item) => item.signal === "contradicts").length;

    return {
      status: "complete",
      source: snapshot.source,
      summary:
        (simulated ? "Simulated checkout evidence. " : "") +
        `Inspected ${serviceEntries.length} runtime log entries and clustered them into ${signatures.length} signature(s). ` +
        `${supporting} candidate(s) supported, ${contradicting} contradicted, ${findings.length - supporting - contradicting} neutral.`,
      entriesInspected: serviceEntries.length,
      signatures,
      findings,
      evidence: findings
        .filter((finding) => finding.relatedSignatures.length > 0)
        .map((finding) =>
          findingToEvidence(finding, snapshot.source, snapshot.fetchedAt),
        ),
      fetchedAt: snapshot.fetchedAt,
    };
  } catch (error) {
    const message =
      error instanceof RuntimeLogProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown runtime log provider error.";

    return {
      status: "error",
      source: sourceUrl,
      summary: "Log Agent could not inspect runtime logs.",
      entriesInspected: 0,
      signatures: [],
      findings: [],
      evidence: [],
      error: message,
    };
  }
}
