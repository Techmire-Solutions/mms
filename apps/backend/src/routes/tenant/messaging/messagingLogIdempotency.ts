import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { canonicalizeJson } from "@mms/shared";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  deleteAuthArtifact,
  findAuthArtifactByLookupKey,
  tryClaimAuthArtifactByLookupKey,
  updateAuthArtifactPayload,
} from "../../../services/auth/authArtifactService.js";

export const MESSAGING_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * An in-flight claim older than this is treated as a crashed request and may be
 * reclaimed. Without it a process that dies between the side effect and the
 * payload write would answer `409 still in progress` for that key for a full day.
 */
export const MESSAGING_IDEMPOTENCY_STALE_MS = 5 * 60 * 1000;
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
  /** Recipients already claimed by an earlier attempt (replay-safe resend). */
  skippedCount?: number;
}

/** Payload persisted for a direct dispatch route claim. */
export type MessagingDispatchPayload = MessagingIdempotencyPayload & {
  response: MessagingDispatchSummary | null;
};

/** Outcome of a claim-or-replay call. `replayed` marks a stored response. */
export interface MessagingIdempotencyOutcome {
  status: 200 | 409;
  body: Record<string, unknown>;
  replayed: boolean;
}

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
 * RFC 8785 canonical digest of the request payload, bound to the idempotency key
 * (`mms-api-interface` §6). Canonicalisation keeps the digest stable when a client
 * retries with the same values in a different key order.
 */
export function messagingDispatchBodyDigest(input: unknown): string {
  return crypto.hash("sha256", canonicalizeJson(input ?? null), "hex");
}

/** Constant-time digest comparison — never short-circuit on a differing prefix. */
export function idempotencyBodyMatches(
  payload: MessagingIdempotencyPayload,
  bodyDigest: string,
): boolean {
  const stored = Buffer.from(String(payload.bodyDigest ?? ""), "utf8");
  const candidate = Buffer.from(bodyDigest, "utf8");
  if (stored.length !== candidate.length) return false;
  return crypto.timingSafeEqual(stored, candidate);
}

export function replyIdempotencyBodyMismatch(reply: {
  status: (code: number) => { send: (body: unknown) => unknown };
}) {
  return reply.status(409).send(MISMATCH_BODY);
}

/**
 * A claim is stale when its 24 h expiry minus the TTL puts the claim time more
 * than {@link MESSAGING_IDEMPOTENCY_STALE_MS} in the past (works for artifacts
 * written before any explicit claim timestamp existed).
 */
function isStaleClaim(expiresAt: Date | undefined): boolean {
  if (!expiresAt) return false;
  const claimedAtMs = expiresAt.getTime() - MESSAGING_IDEMPOTENCY_TTL_MS;
  return Date.now() - claimedAtMs > MESSAGING_IDEMPOTENCY_STALE_MS;
}

/**
 * Claim-or-replay wrapper for messaging POSTs (`mms-api-interface` §6):
 *
 * - existing artifact with a different body digest → 409 mismatch;
 * - existing completed artifact → replay its HTTP body without re-running;
 * - stale in-flight claim (crashed request) → reclaimed and re-run;
 * - fresh in-flight claim or lost claim race → short poll-wait, then 409;
 * - unique claim → run the side effect once → store the replayable response; on
 *   failure the claim is released so retries retry.
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
}): Promise<MessagingIdempotencyOutcome> {
  const { tenantId, userId, clientKey, bodyDigest, flow } = options;
  const lookupKey = messagingIdempotencyLookupKey(tenantId, userId, clientKey);
  const scopeKey = `${authArtifactWorkspaceScopeKey(tenantId)}:${authArtifactUserScopeKey(userId)}`;

  const pollForCompletion = async (): Promise<MessagingIdempotencyOutcome> => {
    for (let attempt = 0; attempt < IDEMPOTENCY_PENDING_POLL_ATTEMPTS; attempt += 1) {
      const existing = await findAuthArtifactByLookupKey<P>("messaging_idempotency", lookupKey);
      if (existing) {
        if (!idempotencyBodyMatches(existing.payload, bodyDigest)) {
          return { status: 409, body: MISMATCH_BODY, replayed: false };
        }
        const body = flow.completedBody(existing.payload);
        if (body) return { status: 200, body, replayed: true };
      }
      await sleep(IDEMPOTENCY_PENDING_POLL_MS);
    }
    return { status: 409, body: IN_PROGRESS_BODY, replayed: false };
  };

  const runClaimed = async (claimId: string): Promise<MessagingIdempotencyOutcome> => {
    try {
      const result = await flow.run();
      const payload = flow.complete(result);
      await updateAuthArtifactPayload(claimId, payload);
      const body = flow.completedBody(payload);
      return body
        ? { status: 200, body, replayed: false }
        : { status: 409, body: IN_PROGRESS_BODY, replayed: false };
    } catch (err) {
      await deleteAuthArtifact(claimId).catch(() => undefined);
      throw err;
    }
  };

  const existingArtifact = await findAuthArtifactByLookupKey<P>("messaging_idempotency", lookupKey);
  if (existingArtifact) {
    if (!idempotencyBodyMatches(existingArtifact.payload, bodyDigest)) {
      return { status: 409, body: MISMATCH_BODY, replayed: false };
    }
    const body = flow.completedBody(existingArtifact.payload);
    if (body) return { status: 200, body, replayed: true };
    if (!isStaleClaim(existingArtifact.expiresAt)) {
      return pollForCompletion();
    }
    // Crashed request: release the abandoned claim so this attempt can run.
    await deleteAuthArtifact(existingArtifact.id).catch(() => undefined);
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

  return runClaimed(claim.id);
}
