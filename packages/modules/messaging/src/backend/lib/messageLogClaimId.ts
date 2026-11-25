import { createHash } from "node:crypto";

/**
 * Deterministic per-recipient delivery id. Retrying a campaign job re-uses the
 * same id, so the repository insert doubles as the send-once claim.
 */
export function buildMessageLogClaimId(jobId: string, contactId: string, channel: string): string {
  const digest = createHash("sha256").update(`${jobId}|${contactId}|${channel}`).digest("hex");
  return `msg-${digest}`;
}
