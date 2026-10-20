"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  saveStoredIncident,
  type IncidentSeverity,
  type StoredIncident,
} from "../lib/incident-store";

const severities = new Set<IncidentSeverity>(["low", "medium", "high", "critical"]);

function requiredText(formData: FormData, key: string, maxLength: number): string {
  const raw = formData.get(key);
  if (typeof raw !== "string") throw new Error(`Missing ${key}`);

  const value = raw.trim().slice(0, maxLength);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

export async function createInvestigation(formData: FormData): Promise<void> {
  const severityRaw = formData.get("severity");
  const severity =
    typeof severityRaw === "string" && severities.has(severityRaw as IncidentSeverity)
      ? (severityRaw as IncidentSeverity)
      : "medium";

  const now = new Date().toISOString();
  const id = `INC-${Date.now().toString(36).toUpperCase()}`;

  const incident: StoredIncident = {
    id,
    title: requiredText(formData, "title", 120),
    description: requiredText(formData, "description", 1200),
    service: requiredText(formData, "service", 80),
    severity,
    status: "awaiting-evidence",
    createdAt: now,
    updatedAt: now,
  };

  await saveStoredIncident(incident);
  revalidatePath("/incidents");
  revalidatePath("/investigations");
  redirect(`/incidents/${incident.id}`);
}
