import type { DatabaseTelemetrySnapshot } from "./database-telemetry";
import type { RuntimeLogSnapshot } from "./runtime-logs";

export const SIMULATED_CHECKOUT_SOURCE = "simulated://checkout";

function checkoutTime(service: string, incidentAt: string): number {
  if (service !== "checkout-service") {
    throw new Error("The simulated checkout providers support checkout-service only.");
  }
  const time = Date.parse(incidentAt);
  if (!Number.isFinite(time)) throw new Error("Simulation requires a valid incident timestamp.");
  return time;
}

export class SimulatedRuntimeLogProvider {
  constructor(private readonly incidentAt: string) {}

  async query(input: {
    service: string;
    from: string;
    to: string;
    limit?: number;
  }): Promise<RuntimeLogSnapshot> {
    const incidentTime = checkoutTime(input.service, this.incidentAt);
    const from = Date.parse(input.from);
    const to = Date.parse(input.to);
    const limit = input.limit ?? 2000;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to ||
        !Number.isInteger(limit) || limit < 1) {
      throw new Error("Simulation requires a valid time range and a positive integer limit.");
    }

    // Match the seeded ten-minute window ending 7m20s after incident intake.
    const firstSeen = incidentTime - 160_000;
    const entries: RuntimeLogSnapshot["entries"] = Array.from({ length: 1248 }, (_, index) => ({
      timestamp: new Date(firstSeen + Math.floor(index * 600_000 / 1247)).toISOString(),
      level: "error",
      message: "DB_CONNECTION_ACQUIRE_TIMEOUT checkout workers waiting for database connection pool",
      service: "checkout-service",
      traceId: `checkout-sim-${index + 1}`,
      metadata: { simulated: true },
    }));

    return {
      entries: entries.filter((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return timestamp >= from && timestamp <= to;
      }).slice(0, Math.min(limit, 2000)),
      source: SIMULATED_CHECKOUT_SOURCE,
      fetchedAt: new Date(incidentTime + 480_000).toISOString(),
    };
  }
}

export class SimulatedDatabaseTelemetryProvider {
  async inspect(input: { service: string; incidentAt: string }): Promise<DatabaseTelemetrySnapshot> {
    const incidentTime = checkoutTime(input.service, input.incidentAt);
    return {
      provider: "simulated-postgresql",
      database: "checkout-demo",
      capturedAt: new Date(incidentTime + 460_000).toISOString(),
      connections: { active: 100, idle: 0, waiting: 56, max: 100, utilizationPercent: 100 },
      queries: { longRunning: 0, longestSeconds: 0 },
      locks: { blockedSessions: 0, blockingSessions: 0 },
      waits: [{ type: "Pool", event: "ConnectionAcquire", count: 56 }],
      metadata: { simulated: true },
    };
  }
}
