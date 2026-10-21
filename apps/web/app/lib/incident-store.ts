import "server-only";
import { cookies } from "next/headers";
import { insertIncident, readIncident, readIncidents } from "./history-store";
import { isWorkspaceId, WORKSPACE_COOKIE } from "./workspace";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type InvestigationStatus = "awaiting-evidence" | "investigating" | "ready";

export interface StoredIncident {
  id: string;
  title: string;
  description: string;
  service: string;
  repository?: string;
  severity: IncidentSeverity;
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
}

export function decodeLegacyIncidents(value?: string): StoredIncident[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Record<string, unknown>;
      const text = (key: string, limit: number) => typeof raw[key] === "string" && raw[key].trim().length > 0 && raw[key].length <= limit;
      if (!text("id", 84) || !/^INC-[A-Z0-9-]+$/.test(String(raw.id)) || !text("title", 120) || !text("description", 1200) || !text("service", 80) ||
        (raw.repository !== undefined && !text("repository", 200)) || !["low", "medium", "high", "critical"].includes(String(raw.severity)) ||
        !text("createdAt", 40) || !text("updatedAt", 40) || !Number.isFinite(Date.parse(String(raw.createdAt))) || !Number.isFinite(Date.parse(String(raw.updatedAt)))) return [];
      return [{ id: String(raw.id), title: String(raw.title), description: String(raw.description), service: String(raw.service),
        repository: raw.repository === undefined ? undefined : String(raw.repository), severity: raw.severity as IncidentSeverity,
        status: "awaiting-evidence" as const, createdAt: String(raw.createdAt), updatedAt: String(raw.updatedAt) }];
    });
  } catch {
    return [];
  }
}

export async function getWorkspaceId(): Promise<string> {
  const store = await cookies();
  const id = store.get(WORKSPACE_COOKIE)?.value;
  if (!isWorkspaceId(id)) throw new Error("Workspace is unavailable. Enable cookies and reload the page.");
  for (const incident of decodeLegacyIncidents(store.get("devrelay_incidents_v1")?.value)) insertIncident(id, incident);
  return id;
}

export async function listStoredIncidents(): Promise<StoredIncident[]> {
  return readIncidents(await getWorkspaceId());
}

export async function getStoredIncident(id: string): Promise<StoredIncident | undefined> {
  return readIncident(await getWorkspaceId(), id);
}

export async function saveStoredIncident(incident: StoredIncident): Promise<void> {
  insertIncident(await getWorkspaceId(), incident);
}
