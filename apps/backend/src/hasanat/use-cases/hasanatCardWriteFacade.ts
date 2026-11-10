/**
 * Card delete/restore wrappers that reconcile tier evidence in the same transaction, plus the
 * batch-award facade methods. Split from `hasanatUseCases` to keep every module under 300 lines.
 */

import {
  HASANAT_BATCH_INLINE_MAX,
  type HasanatBatchAwardBody,
  type HasanatModulePreferences,
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
import { assertAwardScope } from "./hasanatAwardScope.js";
import { withTenant } from "../../db/tenant-context.js";
import { archiveCardEvidence, restoreCardEvidence } from "./hasanatCardArchive.js";
import { ConflictError } from "../../lib/httpErrors.js";
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
  loadPreferences: () => Promise<HasanatModulePreferences>;
}) {
  const { repo, crud, requireTenant, requireActorUserId, loadPreferences } = options;

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
        const [before] = await repo.findDistributionsByIds(tenant, [id], { deleted: "all" });
        const ok = await crud.deleteById(id, deletedBy, reason);
        if (!ok) return false;
        const after = before
          ? {
              ...before,
              deletedAt: new Date().toISOString(),
              deletedBy,
              deletionReason: reason ?? null,
            }
          : null;
        if (before && after) {
          await archiveCardEvidence({ tenant, cards: [before], deletedBy, reason });
        }
        await reconcileTiersForCards(tenant, [id], { actorUserId: deletedBy });
        return true;
      });
    },
    restoreDistributionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const [before] = await repo.findDistributionsByIds(tenant, [id], { deleted: "all" });
        const ok = await crud.restoreById(id, userId);
        if (!ok) return false;
        if (before) {
          await restoreCardEvidence({ tenant, cards: [before], restoredBy: userId ?? null });
        }
        await reconcileTiersForCards(tenant, [id], { actorUserId: userId ?? null });
        return true;
      });
    },
    bulkSoftDeleteDistributions: async (
      ids: string[],
      deletedBy: string,
      reason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const beforeRows = await repo.findDistributionsByIds(tenant, ids, { deleted: "all" });
        const result = await crud.bulkDeleteByIds(ids, deletedBy, reason);
        if (result.succeeded > 0) {
          await archiveCardEvidence({ tenant, cards: beforeRows, deletedBy, reason });
          await reconcileTiersForCards(tenant, ids, { actorUserId: deletedBy });
        }
        return result;
      });
    },
    bulkRestoreDistributions: async (
      ids: string[],
      userId?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      return withTenant(tenant, async () => {
        const beforeRows = await repo.findDistributionsByIds(tenant, ids, { deleted: "all" });
        const result = await crud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) {
          await restoreCardEvidence({ tenant, cards: beforeRows, restoredBy: userId ?? null });
          await reconcileTiersForCards(tenant, ids, { actorUserId: userId ?? null });
        }
        return result;
      });
    },

    /** Preview a batch award target (count, stock and quota headroom). */
    batchRecipients: async (
      input: { target: HasanatBatchTarget },
      options?: { bypassAwardScope?: boolean },
    ): Promise<HasanatBatchRecipientsResponse> => {
      const tenant = requireTenant();
      const recipients = await resolveBatchAwardRecipients(tenant, input.target);
      const preferences = await loadPreferences();
      await assertAwardScope({
        tenant,
        repo,
        actorUserId: requireActorUserId(),
        bypass: options?.bypassAwardScope === true,
        awardScope: preferences.awardScope,
        classIds: input.target.kind === "class" ? [input.target.classId] : [],
        studentIds: recipients.map((recipient) => recipient.studentId),
      });
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
    batchAward: async (body: HasanatBatchAwardBody, options?: { bypassAwardScope?: boolean }) => {
      const tenant = requireTenant();
      const actorUserId = requireActorUserId();
      const recipients = await resolveBatchAwardRecipients(tenant, body.target);
      if (recipients.length === 0) {
        throw new ConflictError(
          "No active students match this batch target.",
          "empty_batch_target",
        );
      }
      const preferences = await loadPreferences();
      const actor = {
        userId: actorUserId,
        quotaLimit: preferences.dailyAwardLimitPerInstructor,
        awardScope: preferences.awardScope,
        bypassAwardScope: options?.bypassAwardScope === true,
      };

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
            quotaLimit: preferences.dailyAwardLimitPerInstructor,
            awardScope: preferences.awardScope,
            bypassAwardScope: actor.bypassAwardScope,
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

      const result = await issueHasanatCardsBatch(tenant, body, actor, repo, { recipients });
      await broadcastCollection("hasanat_distributions");
      return result;
    },
  };
}
