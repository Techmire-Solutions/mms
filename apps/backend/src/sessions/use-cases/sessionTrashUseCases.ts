import {
  canTransitionSession,
  dedupeTrimmedIds,
  normalizeSessionStatus,
  parseSessionStatus,
} from "@mms/shared";
import type { SessionsRepository } from "../repository/sessionsRepository.js";
import { getRequestTenant, getRequestUserId } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { hasActiveTransaction } from "../../db/dbTransactions.js";
import { withSavepoint } from "../../db/transactionSideEffects.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { transitionSession } from "./sessionTransitionService.js";

/**
 * Session trash + bulk-status operations, split out of `sessionsUseCases` to keep that file inside
 * the 300-line ceiling. Every status change still goes through the single transition service.
 */
export function createSessionTrashUseCases(repo: SessionsRepository) {
  return {
    deleteSessionById: async (
      id: string,
      deletedBy?: string,
      deletionReason?: string,
      options?: { allowNonTerminal?: boolean },
    ): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) return false;
      const existing = await repo.findSessionById(tenant, id);
      if (!existing) throw new NotFoundError("Session not found");
      if (existing.deletedAt) throw new NotFoundError("Session is already archived");
      const state = normalizeSessionStatus(existing.status);
      const terminal = state === "completed" || state === "cancelled" || state === "archived";
      // A live session still owns seats/billing: trashing it leaves its lifecycle unfinished and
      // hides the fact that enrollments were cascaded.
      if (!terminal) {
        const reason = (deletionReason ?? "").trim();
        if (!options?.allowNonTerminal || reason.length < 3)
          throw new ConflictError(
            `A ${state} session cannot be archived — complete or cancel it first (or override with a reason)`,
          );
      }
      const ok = await repo.softDeleteSessionWithCascade(tenant, id, deletedBy, deletionReason);
      if (!ok) throw new NotFoundError("Session not found");
      runAfterCommit(() => broadcastCollection("sessions"));
      runAfterCommit(() => broadcastCollection("enrollments"));
      runAfterCommit(() => invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" }));
      return true;
    },
    restoreSessionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) return false;
      const ok = await repo.restoreSessionWithCascade(tenant, id, userId);
      if (!ok) {
        const existing = await repo.findSessionById(tenant, id);
        if (existing && !existing.deletedAt) {
          throw new NotFoundError("Session is already active");
        }
        throw new NotFoundError("Session not found");
      }
      await broadcastCollection("sessions");
      await broadcastCollection("enrollments");
      await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
      return true;
    },
    bulkSoftDeleteSessions: async (
      ids: string[],
      deletedBy: string,
      deletionReason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const uniqueIds = dedupeTrimmedIds(ids);
      if (!tenant || uniqueIds.length === 0) return { succeeded: 0, failed: uniqueIds.length };
      const res = await repo.bulkSoftDeleteSessionsWithCascade(
        tenant,
        uniqueIds,
        deletedBy,
        deletionReason,
      );
      if (res.succeeded > 0) {
        await broadcastCollection("sessions");
        await broadcastCollection("enrollments");
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
      }
      return res;
    },
    bulkRestoreSessions: async (
      ids: string[],
      userId?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const uniqueIds = dedupeTrimmedIds(ids);
      if (!tenant || uniqueIds.length === 0) return { succeeded: 0, failed: uniqueIds.length };
      const res = await repo.bulkRestoreSessionsWithCascade(tenant, uniqueIds, userId);
      if (res.succeeded > 0) {
        await broadcastCollection("sessions");
        await broadcastCollection("enrollments");
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
      }
      return res;
    },

    bulkUpdateSessionsStatus: async (
      ids: string[],
      status: string,
      reason?: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const uniqueIds = dedupeTrimmedIds(ids);
      if (!tenant || uniqueIds.length === 0) return { succeeded: 0, failed: uniqueIds.length };
      const target = parseSessionStatus(status);
      // One status query for the whole batch; each item then goes through the same transition
      // service as a single edit (guards + CAS + audit + effects), inside a per-item savepoint so one
      // refusal cannot abort the batch.
      const stored = await repo.findSessionStatusesByIds(tenant, uniqueIds);
      let succeeded = 0;
      let failed = 0;
      for (const sessionId of uniqueIds) {
        const current = stored.get(sessionId);
        if (!current || !canTransitionSession(String(current), target)) {
          failed += 1;
          continue;
        }
        const run = () =>
          transitionSession(tenant, sessionId, {
            to: target,
            reason,
            actor: { userId: getRequestUserId() ?? null },
          });
        try {
          if (hasActiveTransaction()) await withSavepoint(run);
          else await run();
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      if (succeeded > 0) {
        runAfterCommit(() => invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" }));
        runAfterCommit(() => broadcastCollection("sessions"));
      }
      return { succeeded, failed };
    },
  };
}
