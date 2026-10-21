import { connection } from "next/server";
import type { CanonicalReasoningPacket } from "@devrelay/core";
import { createApprovalSession } from "../lib/approval-store";
import { ApprovalGate } from "./ApprovalGate";

export async function InvestigationReview({ packet }: { packet: CanonicalReasoningPacket }) {
  await connection();
  const sessionId = createApprovalSession(packet);
  return <ApprovalGate key={sessionId} initialPacket={packet} sessionId={sessionId} />;
}
