import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  deleteAuthArtifact,
  findAuthArtifactByLookupKey,
  tryClaimAuthArtifactByLookupKey,
  updateAuthArtifactPayload,
} from "../../../services/auth/authArtifactService.js";

export const MESSAGING_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_PENDING_POLL_MS = 25;
const IDEMPOTENCY_PENDING_POLL_ATTEMPTS = 8;

/** Base shape of every messaging idempotency artifact payload. */
export interface MessagingIdempotencyPayload {
  bodyDigest: string;
}

/** `recorded: null` = in-flight claim; number = completed dispatch audit. */
export type MessagingRecordLogsPayload = MessagingIdempotencyPayload & {
  recorded: number | null;
};

/** Send summary captured for direct (non-queued) dispatch routes. */
export interface MessagingDispatchSummary {
  sentCount: number;
  failedCount: number;
  total: number;
}

/** Payload persisted for a direct dispatch route claim. */
export type MessagingDispatchPayload = MessagingIdempotencyPayload & {
  response: MessagingDispatchSummary | null;
};

const MISMATCH_BODY: Record<string, unknown> = {
  type: "conflict",
  message: "Idempotency key reused with a different request body",
};
const IN_PROGRESS_BODY: Record<string, unknown> = {
  type: "conflict",
  message: "Idempotent request still in progress",
};

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

/**
 * Digest of the dispatch payload object — bound to the idempotency key
 * (`mms-api-interface` §6). Accepts any structured payload (record-log
 * batches, dispatch bodies) so every messaging POST shares the flow.
 */
export function messagingDispatchBodyDigest(input: unknown): string {
  return crypto.hash("sha256", JSON.stringify(input ?? null), "hex");
}

export function idempotencyBodyMatches(
  payload: MessagingIdempotencyPayload,
  bodyDigest: string,
): boolean {
  return payload.bodyDigest === bodyDigest;
}

export function replyIdempotencyBodyMismatch(reply: {
  status: (code: number) => { send: (body: unknown) => unknown };
}) {
  return reply.status(409).send(MISMATCH_BODY);
}

/**
 * Claim-or-replay wrapper for messaging POSTs (`mms-api-interface` §6):
 *
 * - existing artifact with a different body digest → 409 mismatch;
 * - existing completed artifact → replay its HTTP body without re-running;
 * - existing in-flight (pending) artifact or lost claim race → short poll-wait
 *   for completion, replay when finished, 409 "still in progress" otherwise;
 * - unique claim → run the side effect once → finalize the payload with the
 *   replayable response; on failure the claim is released so retries retry.
 */
export async function withMessagingIdempotency<
  P extends MessagingIdempotencyPayload,
  T = void,
>(options: {
  tenantId: string;
  userId: string;
  clientKey: string;
  bodyDigest: string;
  flow: {
    /** In-flight claim payload written when the key is claimed. */
    claim: P;
    /** Completed payload persisted after the side effect succeeds. */
    complete: (result: T) => P;
    /** HTTP body replayed for a completed payload; null while in-flight. */
    completedBody: (payload: P) => Record<string, unknown> | null;
    /** The side effect — executed exactly once per claim. */
    run: () => Promise<T>;
  };
}): Promise<{ status: 200 | 409; body: Record<string, unknown> }> {
  const { tenantId, userId, clientKey, bodyDigest, flow } = options;
  const lookupKey = messagingIdempotencyLookupKey(tenantId, userId, clientKey);
  const scopeKey = `${authArtifactWorkspaceScopeKey(tenantId)}:${authArtifactUserScopeKey(
    userId,
  )}`;

  const pollForCompletion = async (): Promise<{ status: 200 | 409; body: Record<string, unknown> }> => {
    for (let attempt = 0; attempt < IDEMPOTENCY_PENDING_POLL_ATTEMPTS; attempt += 1) {
      const existing = await findAuthArtifactByLookupKey<P>("messaging_idempotency", lookupKey);
      if (existing) {
        if (!idempotencyBodyMatches(existing.payload, bodyDigest)) {
          return { status: 409, body: MISMATCH_BODY };
        }
        const body = flow.completedBody(existing.payload);
        if (body) return { status: 200, body };
      }
      await sleep(IDEMPOTENCY_PENDING_POLL_MS);
    }
    return { status: 409, body: IN_PROGRESS_BODY };
  };

  const existingArtifact = await findAuthArtifactByLookupKey<P>("messaging_idempotency", lookupKey);
  if (existingArtifact) {
    if (!idempotencyBodyMatches(existingArtifact.payload, bodyDigest)) {
      return { status: 409, body: MISMATCH_BODY };
    }
    const body = flow.completedBody(existingArtifact.payload);
    if (body) return { status: 200, body };
    return pollForCompletion();
  }

  const claim = await tryClaimAuthArtifactByLookupKey<P>(
    "messaging_idempotency",
    flow.claim,
    MESSAGING_IDEMPOTENCY_TTL_MS,
    { lookupKey, scopeKey },
  );
  if (!claim.claimed) {
    return pollForCompletion();
  }

  try {
    const result = await flow.run();
    const payload = flow.complete(result);
    await updateAuthArtifactPayload(claim.id, payload);
    const body = flow.completedBody(payload);
    return body ? { status: 200 as const, body } : { status: 409 as const, body: IN_PROGRESS_BODY };
  } catch (err) {
    await deleteAuthArtifact(claim.id).catch(() => undefined);
    throw err;
  }
}
