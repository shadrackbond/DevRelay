import "server-only";
import { recordStoredDecision } from "./history-store";
import { getWorkspaceId } from "./incident-store";

export async function decideApprovalSession(runId: string, formData: FormData) {
  try {
    return recordStoredDecision(await getWorkspaceId(), runId, formData);
  } catch {
    return { error: true, message: "Decision could not be saved. Reload to check history before trying again. No action was executed." };
  }
}
