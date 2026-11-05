import type { SessionsRepository } from "../repository/sessionsRepository.js";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  assertSessionEditable,
  workspaceToday,
  type SessionLockContext,
  assertSessionDateRange,
} from "./sessionLockGuard.js";
import { onSessionsCancelled } from "./sessionLifecycleOpsUseCases.js";
import { createSessionReadUseCases } from "./sessionReadUseCases.js";
import {
  sessionRecordSchema,
  type SessionRecord,
  type SessionCreateBody,
  type SessionUpdateBody,
} from "@mms/shared";
import {
  canTransitionSession,
  dedupeTrimmedIds,
  normalizeSessionStatus,
  normalizeStoredSession,
  type Session,
} from "@mms/shared";

interface SessionsUseCasesDependencies {
  findFacultyByIds?: (
    tenant: string,
    ids: string[],
  ) => Promise<Array<{ id: string | number; deletedAt?: unknown }>>;
}

/**
 * Sessions use-cases — composition root binding a {@link SessionsRepository} to
 * every operation. Production uses the default Drizzle-backed `sessionsUseCases`;
 * tests can pass a fake repository to exercise orchestration in isolation.
 */
export function createSessionsUseCases(
  repo: SessionsRepository = sessionsRepository,
  deps?: SessionsUseCasesDependencies,
) {
  const crud = createGenericRelationalService<SessionRecord>({
    repo: {
      listByWorkspace: repo.listSessionsByWorkspace,
      findById: repo.findSessionById,
      save: async (tenant, record) => {
        await repo.saveSession(tenant, record);
      },
    },
    schema: sessionRecordSchema,
    websocketCollection: "sessions",
    idPrefix: "sess",
    normalizeFn: normalizeStoredSession as (record: SessionRecord) => SessionRecord,
  });

  const validateActiveFacultyForeignKeys = async (
    tenant: string,
    record: Partial<SessionRecord>,
  ) => {
    const facultyIds = dedupeTrimmedIds(
      (record.classes ?? []).map((c) => c.facultyId).filter(Boolean),
    );
    if (facultyIds.length > 0) {
      const getFaculty =
        deps?.findFacultyByIds ??
        (await import("../../db/repositories/facultyRepository.js")).findFacultyByIds;
      const facultyList = await getFaculty(tenant, facultyIds);
      const activeFacultyIds = new Set(
        facultyList.filter((f) => !f.deletedAt).map((f) => String(f.id)),
      );
      for (const facultyId of facultyIds) {
        if (!activeFacultyIds.has(facultyId)) {
          const err = new Error("Referenced faculty is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
    }
  };

  const reads = createSessionReadUseCases(repo);

  return {
    loadSessions: crud.loadAll,
    loadSessionById: crud.loadById,
    ...reads,
    createSession: async (record: SessionCreateBody | SessionRecord): Promise<SessionRecord> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const requestedId = typeof record.id === "string" ? record.id.trim() : "";
      // `saveSession` is an upsert; a client-provided id that already exists would replace a
      // started/completed session (and resurrect an archived one) without the lock/restore paths.
      if (requestedId && typeof repo.findSessionById === "function") {
        const existing = await repo.findSessionById(tenant, requestedId);
        if (existing) throw new ConflictError("A session with this id already exists");
      }
      await validateActiveFacultyForeignKeys(tenant, record);
      assertSessionDateRange(record);
      return crud.create({
        ...record,
        status: normalizeSessionStatus(record.status),
      } as SessionRecord);
    },
    updateSessionById: async (
      id: string,
      body: SessionUpdateBody | Partial<SessionRecord>,
      lock: SessionLockContext = { canOverrideLock: false },
      expectedUpdatedAt?: string,
    ): Promise<SessionRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const expected = expectedUpdatedAt?.trim();
      if (expected && Number.isNaN(Date.parse(expected)))
        throw new ValidationError("Invalid x-expected-updated-at header");
      const { lockOverrideReason, ...record } = body as SessionUpdateBody;
      const next = {
        ...record,
        ...(record.status !== undefined ? { status: normalizeSessionStatus(record.status) } : {}),
      };
      await validateActiveFacultyForeignKeys(tenant, next);
      const before = await repo.findSessionById(tenant, id);
      if (!before || before.deletedAt) return null;
      const overridden = assertSessionEditable(before, { ...before, ...next } as Session, {
        ...lock,
        today: lock.today ?? (await workspaceToday(tenant)),
        lockOverrideReason: lockOverrideReason ?? lock.lockOverrideReason,
      });
      assertSessionDateRange({ ...before, ...next });

      const merged: Record<string, unknown> = { ...before };
      for (const [key, value] of Object.entries(next)) {
        if (value !== undefined) merged[key] = value;
      }
      const normalized = normalizeStoredSession(
        sessionRecordSchema.parse({ ...merged, id }),
      ) as SessionRecord;
      // The version predicate lives in the repository's row-locked write (OCC 409).
      const savedUpdatedAt = await repo.saveSession(
        tenant,
        normalized,
        expected ? { expectedUpdatedAt: expected } : undefined,
      );
      // Return the version the DB actually wrote so the next save can use it as its OCC token.
      normalized.updatedAt = savedUpdatedAt;
      await broadcastCollection("sessions");
      await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions", key: id });
      if (next.status === "cancelled" && before.status !== "cancelled")
        await onSessionsCancelled(tenant, [id]);
      if (overridden.length > 0) {
        await recordModernAuditEvent({
          workspaceSubdomain: tenant,
          tableName: "sessions",
          recordId: id,
          actionType: "UPDATE",
          newState: {
            lockOverride: overridden,
            reason: lockOverrideReason ?? lock.lockOverrideReason,
          },
        });
      }
      return normalized;
    },
    deleteSessionById: async (
      id: string,
      deletedBy?: string,
      deletionReason?: string,
    ): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) return false;
      const ok = await repo.softDeleteSessionWithCascade(tenant, id, deletedBy, deletionReason);
      if (!ok) {
        const existing = await repo.findSessionById(tenant, id);
        if (existing?.deletedAt) {
          throw new NotFoundError("Session is already archived");
        }
        throw new NotFoundError("Session not found");
      }
      await broadcastCollection("sessions");
      await broadcastCollection("enrollments");
      await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
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
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      const uniqueIds = dedupeTrimmedIds(ids);
      if (!tenant || uniqueIds.length === 0) return { succeeded: 0, failed: uniqueIds.length };
      const target = normalizeSessionStatus(status);
      // One status query for the whole batch: a per-id read fans out one transaction each.
      const stored = await repo.findSessionStatusesByIds(tenant, uniqueIds);
      const allowed = uniqueIds.filter((sessionId) => {
        const current = stored.get(sessionId);
        return Boolean(current) && canTransitionSession(String(current), target);
      });
      const result =
        allowed.length > 0
          ? await repo.bulkUpdateSessionsStatus(tenant, allowed, target)
          : { succeeded: 0, failed: 0 };
      result.failed += uniqueIds.length - allowed.length;
      if (target === "cancelled" && result.succeeded) await onSessionsCancelled(tenant, allowed);
      if (result.succeeded > 0) {
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
        await broadcastCollection("sessions");
      }
      return result;
    },
  };
}

export const sessionsUseCases = createSessionsUseCases();
