import type { FastifyReply } from "fastify";
import { createConcurrencyLimiter, type ConcurrencyLimiter } from "./concurrencyLimiter.js";

/**
 * Admission control for long-lived streaming responses.
 *
 * These responses hold a checked-out pooled DB client for their entire duration
 * (see `beginLongLivedTenantTransaction`), which can be minutes for a large
 * workspace. The pool is the scarcest resource in the request path —
 * `PG_POOL_MAX` defaults to 20 and is shared by every concurrent request — so
 * without a cap a handful of concurrent downloads (an admin opening several
 * tabs) would stall every ordinary request until `connectionTimeoutMillis`
 * expires.
 *
 * Excess requests are shed with `503 Service Unavailable` and a `Retry-After`
 * header rather than queueing, so the client can back off explicitly.
 */
export interface StreamAdmissionControl {
  /**
   * Claims a stream slot. Returns an idempotent release function, or `null`
   * after replying 503 — in which case the caller MUST stop and return without
   * opening a transaction.
   */
  acquire(reply: FastifyReply): (() => void) | null;
  /** Slots currently held (for logging and tests). */
  inFlight(): number;
  /** Configured ceiling. */
  readonly limit: number;
}

export function createStreamAdmissionControl(options: {
  limit: number;
  retryAfterSeconds?: number;
  unavailableMessage?: string;
  type?: string;
}): StreamAdmissionControl {
  const limit = Math.max(1, options.limit);
  const retryAfterSeconds = options.retryAfterSeconds ?? 30;
  const type = options.type ?? "snapshot_unavailable";
  const limiter: ConcurrencyLimiter = createConcurrencyLimiter(limit);

  return {
    limit,
    inFlight: () => limiter.inFlight(),
    acquire(reply: FastifyReply) {
      const release = limiter.tryAcquire();
      if (release) return release;

      reply.header("Retry-After", String(retryAfterSeconds));
      void reply.status(503).send({
        type,
        message:
          options.unavailableMessage ??
          "Too many snapshot downloads are in progress. Please retry shortly.",
      });
      return null;
    },
  };
}
