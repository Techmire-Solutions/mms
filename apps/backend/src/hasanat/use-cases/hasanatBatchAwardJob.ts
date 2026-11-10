/**
 * `hasanat:bulk-award` background runner.
 *
 * Large groups (above `HASANAT_BATCH_INLINE_MAX`) are chunked so that one bad chunk cannot roll
 * back the whole award: each chunk is its own transaction, per-recipient idempotency keys make a
 * retry safe, and the job reports how many cards were issued plus the row-level errors.
 */

import {
  HASANAT_BATCH_INLINE_MAX,
  HASANAT_BATCH_JOB_CHUNK,
  batchCardRequestId,
  type HasanatBatchAwardBody,
  type HasanatBatchRecipient,
} from "@mms/shared";
import { logger } from "../../lib/logger.js";
import {
  registerBackgroundJobRunner,
  type BackgroundJobRunContext,
} from "../../services/backgroundJobWorkerService.js";
import { hasanatRepository } from "../repository/hasanatRepositoryAdapter.js";
import {
  issueHasanatCardsBatch,
  resolveBatchAwardRecipients,
} from "./hasanatBatchAwardUseCases.js";

export const HASANAT_BULK_AWARD_JOB_KIND = "bulk-award";

export interface HasanatBulkAwardPayload {
  body: HasanatBatchAwardBody;
  actorUserId: string;
  actorName?: string | null;
  quotaLimit?: number | null;
  recipients?: HasanatBatchRecipient[];
}

let registered = false;

/** Registers the runner once per process (route setup calls this). */
export function registerHasanatBulkAwardRunner(): void {
  if (registered) return;
  registered = true;

  registerBackgroundJobRunner(
    `hasanat:${HASANAT_BULK_AWARD_JOB_KIND}`,
    async (payload, ctx: BackgroundJobRunContext) => {
      const job = payload as HasanatBulkAwardPayload;
      if (!job?.body) {
        throw new Error("hasanat:bulk-award payload is missing the award body");
      }

      const recipients =
        job.recipients && job.recipients.length > 0
          ? job.recipients
          : await resolveBatchAwardRecipients(ctx.tenant, job.body.target);

      const total = recipients.length;
      await ctx.updateProgress(0, Math.max(total, 1));

      let issued = 0;
      const errors: Array<{ row: number; reason: string }> = [];

      for (let index = 0; index < recipients.length; index += HASANAT_BATCH_JOB_CHUNK) {
        if (ctx.signal?.aborted) break;
        const chunk = recipients.slice(index, index + HASANAT_BATCH_JOB_CHUNK);
        try {
          const result = await issueHasanatCardsBatch(
            ctx.tenant,
            job.body,
            {
              userId: job.actorUserId,
              displayName: job.actorName ?? null,
              quotaLimit: job.quotaLimit,
            },
            hasanatRepository,
            { recipients: chunk, enforceInlineCap: false },
          );
          issued += result.issued;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn({ err: message, chunkStart: index }, "hasanat bulk award chunk failed");
          errors.push({ row: index + 1, reason: message });
        }
        await ctx.updateProgress(Math.min(index + chunk.length, total), Math.max(total, 1));
      }

      await ctx.complete({
        label:
          errors.length === 0
            ? `Issued ${issued} Hasanat card(s)`
            : `Issued ${issued} of ${total} Hasanat card(s) — ${errors.length} chunk(s) failed`,
        progress: { current: issued, total: Math.max(total, 1) },
        ...(errors.length > 0 ? { errors: errors.slice(0, 500) } : {}),
      });
    },
  );
}

/** Deterministic idempotency key for one recipient (also used by the inline path). */
export { batchCardRequestId, HASANAT_BATCH_INLINE_MAX };
