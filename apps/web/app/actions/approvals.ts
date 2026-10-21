"use server";

import { decideApprovalSession } from "../lib/approval-store";

export async function decideApproval(sessionId: string, formData: FormData) {
  return decideApprovalSession(sessionId, formData);
}
