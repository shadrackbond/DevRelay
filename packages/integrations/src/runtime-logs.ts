export type RuntimeLogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "unknown";

export interface RuntimeLogEntry {
  timestamp: string;
  level: RuntimeLogLevel;
  message: string;
  service?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeLogSnapshot {
  entries: RuntimeLogEntry[];
  source: string;
  fetchedAt: string;
}

export class RuntimeLogProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "RuntimeLogProviderError";
  }
}

function normalizeLevel(value: unknown): RuntimeLogLevel {
  const level = String(value ?? "unknown").toLowerCase();

  if (["debug", "info", "warn", "error", "fatal"].includes(level)) {
    return level as RuntimeLogLevel;
  }

  if (level === "warning") return "warn";
  if (level === "critical") return "fatal";
  return "unknown";
}

function normalizeEntry(value: unknown): RuntimeLogEntry | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const timestamp = raw.timestamp ?? raw.time ?? raw.datetime;
  const message = raw.message ?? raw.msg ?? raw.text;

  if (typeof timestamp !== "string" || typeof message !== "string") {
    return null;
  }

  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : undefined;

  return {
    timestamp,
    message,
    level: normalizeLevel(raw.level ?? raw.severity),
    service:
      typeof raw.service === "string"
        ? raw.service
        : typeof raw.application === "string"
          ? raw.application
          : undefined,
    traceId:
      typeof raw.traceId === "string"
        ? raw.traceId
        : typeof raw.trace_id === "string"
          ? raw.trace_id
          : undefined,
    metadata,
  };
}

export class HttpRuntimeLogProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  async query(input: {
    service: string;
    from: string;
    to: string;
    limit?: number;
  }): Promise<RuntimeLogSnapshot> {
    if (!this.baseUrl) {
      throw new RuntimeLogProviderError("LOG_SOURCE_URL is not configured.");
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("service", input.service);
    url.searchParams.set("from", input.from);
    url.searchParams.set("to", input.to);
    url.searchParams.set("limit", String(Math.min(input.limit ?? 500, 2000)));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DevRelay-Log-Agent",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "";
      try {
        const payload = (await response.json()) as { message?: string };
        detail = payload.message ? `: ${payload.message}` : "";
      } catch {
        // Ignore non-JSON error bodies.
      }

      throw new RuntimeLogProviderError(
        `Runtime log request failed (${response.status})${detail}`,
        response.status,
      );
    }

    const payload = (await response.json()) as
      | unknown[]
      | { entries?: unknown[]; logs?: unknown[] };

    const rawEntries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.entries)
        ? payload.entries
        : Array.isArray(payload.logs)
          ? payload.logs
          : [];

    const entries = rawEntries
      .map(normalizeEntry)
      .filter((entry): entry is RuntimeLogEntry => entry !== null)
      .filter((entry) => {
        const time = new Date(entry.timestamp).getTime();
        return Number.isFinite(time);
      })
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    return {
      entries,
      source: url.origin,
      fetchedAt: new Date().toISOString(),
    };
  }
}
