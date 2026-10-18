import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { MessageLogCreateDto } from "@mms/shared";
import { findAuthArtifactByLookupKey } from "../../../services/auth/authArtifactService.js";

export const MESSAGING_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_PENDING_POLL_MS = 25;
const IDEMPOTENCY_PENDING_POLL_ATTEMPTS = 8;

/** `recorded: null` = in-flight claim; number = completed dispatch audit. */
export type MessagingIdempotencyPayload = { recorded: number | null; bodyDigest: string };

export function resolveIdempotencyKey(
  bodyKey: string | undefined,
  headerValue: string | string[] | undefined,
): string | undefined {
  const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const raw = (bodyKey ?? fromHeader ?? "").trim();
  return raw.length >= 8 ? raw.slice(0, 128) : undefined;
}

export function messagingIdempotencyLookupKey(
  workspaceSubdomain: string,
  userId: string,
  clientKey: string,
): string {
  const digest = crypto.hash("sha256", `${workspaceSubdomain}\0${userId}\0${clientKey}`, "hex");
  return `messaging_idem:${digest}`;
}

/** Digest of the dispatch logs body — bound to the idempotency key (`mms-api-interface` §6). */
export function messagingDispatchBodyDigest(logs: MessageLogCreateDto[]): string {
  return crypto.hash("sha256", JSON.stringify(logs), "hex");
}

function completedRecorded(payload: MessagingIdempotencyPayload): number | undefined {
  return payload.recorded === null ? undefined : payload.recorded;
}

export function idempotencyBodyMatches(
  payload: MessagingIdempotencyPayload,
  bodyDigest: string,
): boolean {
  return payload.bodyDigest === bodyDigest;
}

export async function waitForCompletedIdempotency(
  lookupKey: string,
  bodyDigest: string,
): Promise<{ recorded: number } | { mismatch: true } | undefined> {
  for (let attempt = 0; attempt < IDEMPOTENCY_PENDING_POLL_ATTEMPTS; attempt += 1) {
    const existing = await findAuthArtifactByLookupKey<MessagingIdempotencyPayload>(
      "messaging_idempotency",
      lookupKey,
    );
    if (existing) {
      if (!idempotencyBodyMatches(existing.payload, bodyDigest)) {
        return { mismatch: true };
      }
      const recorded = completedRecorded(existing.payload);
      if (recorded !== undefined) return { recorded };
    }
    await sleep(IDEMPOTENCY_PENDING_POLL_MS);
  }
  return undefined;
}

export function replyIdempotencyBodyMismatch(reply: {
  status: (code: number) => { send: (body: unknown) => unknown };
}) {
  return reply.status(409).send({
    type: "conflict",
    message: "Idempotency key reused with a different request body",
  });
}
