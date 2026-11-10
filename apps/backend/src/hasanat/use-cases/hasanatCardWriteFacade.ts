/**
 * Card delete/restore wrappers that reconcile tier evidence in the same transaction, plus the
 * batch-award facade methods. Split from `hasanatUseCases` to keep every module under 300 lines.
 */

import {
  HASANAT_BATCH_INLINE_MAX,
  type HasanatBatchAwardBody,
  type HasanatBatchRecipientsResponse,
  type HasanatBatchTarget,
} from "@mms/shared";
import {
  issueHasanatCardsBatch,
  resolveBatchAwardRecipients,
} from "./hasanatBatchAwardUseCases.js";
import {
  HASANAT_BULK_AWARD_JOB_KIND,
  registerHasanatBulkAwardRunner,
} from "./hasanatBatchAwardJob.js";
import { reconcileTiersForCards } from "./hasanatTierUseCases.js";
import { withTenant } from "../../db/tenant-context.js";
import { enqueueBackgroundJob } from "../../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId } from "../../lib/backgroundJobIds.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";

interface CardCrud {
  deleteById: (id: string, deletedBy: string, reason?: string) => Promise<boolean>;
  restoreById: (id: string, userId?: string) => Promise<boolean>;
  bulkDeleteByIds: (
    ids: string[],
    deletedBy: string,
    reason?: string,
  ) => Promise<{ succeeded: number; failed: number }>;
  bulkRestoreByIds: (
    ids: string[],
    userId?: string,
  ) => Promise<{ succeeded: number; failed: number }>;
}

export function createHasanatCardWriteFacade(options: {
  repo: HasanatRepository;
  crud: CardCrud;
  requireTenant: () => string;
  requireActorUserId: () => string;
  loadQuotaLimit: () => Promise<number>;
}) {
  const { repo, crud, requireTenant, requireActorUserId, loadQuotaLimit } = options;

  return {
    /**
     * Delete/restore changes a student's lifetime earned points, so the tier evidence is reconciled
     * in the same tenant transaction as the card change.
     */
    deleteDistributionById: async (
      id: string,
      deletedBy: string,
      reason?: string,
    ): Promise<boolean> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const ok = await crud.deleteById(id, deletedBy, reason);
        if (ok) await reconcileTiersForCards(tenant, [id]);
        return ok;
      });
    },
    restoreDistributionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const ok = await crud.restoreById(id, userId);
        if (ok) await reconcileTiersForCards(tenant, [id]);
        return ok;
      });
    },
    bulkSoftDeleteDistributions: async (
      ids: string[],
      deletedBy: string,
      reason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const result = await crud.bulkDeleteByIds(ids, deletedBy, reason);
        if (result.succeeded > 0) await reconcileTiersForCards(tenant, ids);
        return result;
      });
    },
    bulkRestoreDistributions: async (
      ids: string[],
      userId?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const result = await crud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) await reconcileTiersForCards(tenant, ids);
        return result;
      });
    },

    /** Preview a batch award target (count, stock and quota headroom). */
    batchRecipients: async (input: {
      target: HasanatBatchTarget;
    }): Promise<HasanatBatchRecipientsResponse> => {
      const tenant = requireTenant();
      const recipients = await resolveBatchAwardRecipients(tenant, input.target);
      return {
        recipients,
        count: recipients.length,
        stockRemaining: null,
        quotaRemaining: null,
        requiresJob: recipients.length > HASANAT_BATCH_INLINE_MAX,
      };
    },

    /**
     * Award one card per recipient. Up to `HASANAT_BATCH_INLINE_MAX` runs inline (one transaction);
     * larger groups are queued as `hasanat:bulk-award` and chunked by the worker.
     */
    batchAward: async (body: HasanatBatchAwardBody) => {
      const tenant = requireTenant();
      const actorUserId = requireActorUserId();
      const recipients = await resolveBatchAwardRecipients(tenant, body.target);
      if (recipients.length === 0) {
        throw new Error("No active students match this batch target.");
      }

      if (recipients.length > HASANAT_BATCH_INLINE_MAX) {
        registerHasanatBulkAwardRunner();
        const job = await enqueueBackgroundJob(
          tenant,
          actorUserId,
          {
            id: buildBackgroundJobId(tenant, actorUserId, `hasanat-bulk-${body.clientRequestId}`),
            moduleId: "hasanat",
            kind: HASANAT_BULK_AWARD_JOB_KIND,
            status: "running",
            label: `Awarding Hasanat cards to ${recipients.length} students`,
            createdAt: new Date().toISOString(),
          },
          {
            body,
            actorUserId,
            quotaLimit: await loadQuotaLimit(),
            recipients,
          },
        );
        return {
          issued: 0,
          distributionIds: [],
          skipped: [],
          queued: true,
          jobId: job.id,
        };
      }

      const result = await issueHasanatCardsBatch(
        tenant,
        body,
        { userId: actorUserId, quotaLimit: await loadQuotaLimit() },
        repo,
        { recipients },
      );
      await broadcastCollection("hasanat_distributions");
      return result;
    },
  };
}
