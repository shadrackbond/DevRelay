export interface DatabaseTelemetrySnapshot {
  provider: string;
  database: string;
  capturedAt: string;
  connections: {
    active: number;
    idle: number;
    waiting: number;
    max: number;
    utilizationPercent: number;
  };
  queries: {
    longRunning: number;
    longestSeconds: number;
  };
  locks: {
    blockedSessions: number;
    blockingSessions: number;
  };
  waits: Array<{
    type: string;
    event: string;
    count: number;
  }>;
  metadata?: Record<string, unknown>;
}

export class DatabaseTelemetryProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "DatabaseTelemetryProviderError";
  }
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class HttpDatabaseTelemetryProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  async inspect(input: {
    service: string;
    incidentAt: string;
  }): Promise<DatabaseTelemetrySnapshot> {
    if (!this.baseUrl) {
      throw new DatabaseTelemetryProviderError(
        "DB_TELEMETRY_URL is not configured.",
      );
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("service", input.service);
    url.searchParams.set("incidentAt", input.incidentAt);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DevRelay-Database-Agent",
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

      throw new DatabaseTelemetryProviderError(
        `Database telemetry request failed (${response.status})${detail}`,
        response.status,
      );
    }

    const raw = (await response.json()) as Record<string, unknown>;
    const connections =
      raw.connections && typeof raw.connections === "object"
        ? (raw.connections as Record<string, unknown>)
        : {};
    const queries =
      raw.queries && typeof raw.queries === "object"
        ? (raw.queries as Record<string, unknown>)
        : {};
    const locks =
      raw.locks && typeof raw.locks === "object"
        ? (raw.locks as Record<string, unknown>)
        : {};

    const active = number(connections.active);
    const idle = number(connections.idle);
    const waiting = number(connections.waiting);
    const max = Math.max(1, number(connections.max, active + idle || 1));
    const utilizationPercent =
      number(connections.utilizationPercent) ||
      Math.min(100, Math.round((active / max) * 100));

    const waits = Array.isArray(raw.waits)
      ? raw.waits
          .filter((item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            type: String(item.type ?? "unknown"),
            event: String(item.event ?? "unknown"),
            count: number(item.count),
          }))
      : [];

    return {
      provider: String(raw.provider ?? "postgresql"),
      database: String(raw.database ?? "unknown"),
      capturedAt: String(raw.capturedAt ?? new Date().toISOString()),
      connections: {
        active,
        idle,
        waiting,
        max,
        utilizationPercent,
      },
      queries: {
        longRunning: number(queries.longRunning),
        longestSeconds: number(queries.longestSeconds),
      },
      locks: {
        blockedSessions: number(locks.blockedSessions),
        blockingSessions: number(locks.blockingSessions),
      },
      waits,
      metadata:
        raw.metadata && typeof raw.metadata === "object"
          ? (raw.metadata as Record<string, unknown>)
          : undefined,
    };
  }
}
