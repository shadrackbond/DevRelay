import { cookies } from "next/headers";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type InvestigationStatus = "awaiting-evidence" | "investigating" | "ready";

export interface StoredIncident {
  id: string;
  title: string;
  description: string;
  service: string;
  severity: IncidentSeverity;
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
}

const COOKIE_NAME = "devrelay_incidents_v1";
const MAX_INCIDENTS = 10;

function decode(value?: string): StoredIncident[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredIncident[];
  } catch {
    return [];
  }
}

function encode(items: StoredIncident[]): string {
  return encodeURIComponent(JSON.stringify(items.slice(0, MAX_INCIDENTS)));
}

export async function listStoredIncidents(): Promise<StoredIncident[]> {
  const store = await cookies();
  return decode(store.get(COOKIE_NAME)?.value);
}

export async function getStoredIncident(id: string): Promise<StoredIncident | undefined> {
  const incidents = await listStoredIncidents();
  return incidents.find((incident) => incident.id === id);
}

export async function saveStoredIncident(incident: StoredIncident): Promise<void> {
  const store = await cookies();
  const current = decode(store.get(COOKIE_NAME)?.value);
  const next = [incident, ...current.filter((item) => item.id !== incident.id)];

  store.set(COOKIE_NAME, encode(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}
