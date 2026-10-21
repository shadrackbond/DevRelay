import { NextResponse } from "next/server";
import {
  databaseStorageMode,
  getDatabase,
  resolveDatabasePath,
} from "../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const db = getDatabase();
    db.prepare("SELECT 1 AS ok").get();

    return NextResponse.json({
      status: "ok",
      runtime: "nodejs",
      persistence: {
        mode: databaseStorageMode(),
        path: resolveDatabasePath(),
        durable: process.env.VERCEL !== "1",
      },
      providers: {
        github: Boolean(process.env.GITHUB_TOKEN) ? "authenticated" : "public-only",
        logs: Boolean(process.env.LOG_SOURCE_URL) ? "configured" : "not-configured",
        databaseTelemetry: Boolean(process.env.DB_TELEMETRY_URL)
          ? "configured"
          : "not-configured",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        runtime: "nodejs",
        persistence: {
          mode: databaseStorageMode(),
          path: resolveDatabasePath(),
        },
        error: error instanceof Error ? error.message : "Unknown initialization error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
