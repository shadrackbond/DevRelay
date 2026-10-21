"use server";

import { revalidatePath } from "next/cache";
import { decideApprovalSession } from "../lib/approval-store";

export async function decideApproval(runId: string, formData: FormData) {
  const result = await decideApprovalSession(runId, formData);
  if (!result.error) {
    revalidatePath("/audit");
    revalidatePath(`/incidents/${result.packet!.incident.id}`);
    revalidatePath("/");
  }
  return result;
}
