import type { SessionsRepository } from '../repository/sessionsRepository.js';
import { sessionsRepository } from '../repository/sessionsRepositoryAdapter.js';
import { getRequestTenant } from '../../lib/tenantContext.js';
import { broadcastCollection } from '../../lib/livePush.js';
import { createGenericRelationalService } from '../../services/genericRelationalService.js';
import { NotFoundError } from '../../lib/httpErrors.js';
import { recordModernAuditEvent } from '../../services/auditTrailService.js';
import { assertSessionEditable, type SessionLockContext, assertSessionDateRange } from './sessionLockGuard.js';
import {
  sessionRecordSchema,
  type SessionRecord,
  type SessionCreateBody,
  type SessionUpdateBody,
} from '@mms/shared';
import {
  canTransitionSession,
  dedupeTrimmedIds,
  normalizeSessionStatus,
  normalizeStoredSession,
  type SessionsListQuery,
  type Session,
  type SessionsWidgetQuery,
  type SessionsReportAggregates,
} from '@mms/shared';

export interface SessionsUseCasesDependencies {
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
      save: repo.saveSession,
    },
    schema: sessionRecordSchema,
    websocketCollection: 'sessions',
    idPrefix: 'sess',
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
        (await import('../../db/repositories/facultyRepository.js')).findFacultyByIds;
      const facultyList = await getFaculty(tenant, facultyIds);
      const activeFacultyIds = new Set(
        facultyList.filter((f) => !f.deletedAt).map((f) => String(f.id)),
      );
      for (const facultyId of facultyIds) {
        if (!activeFacultyIds.has(facultyId)) {
          const err = new Error('Referenced faculty is archived or does not exist');
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
    }
  };

  return {
    loadSessions: crud.loadAll,
    loadSessionById: crud.loadById,
    createSession: async (record: SessionCreateBody | SessionRecord): Promise<SessionRecord> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error('Tenant context required');
      await validateActiveFacultyForeignKeys(tenant, record);
      assertSessionDateRange(record);
      return crud.create({ ...record, status: normalizeSessionStatus(record.status) } as SessionRecord);
    },
    updateSessionById: async (
      id: string,
      body: SessionUpdateBody | Partial<SessionRecord>,
      lock: SessionLockContext = { canOverrideLock: false },
    ): Promise<SessionRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error('Tenant context required');
      const { lockOverrideReason, ...record } = body as SessionUpdateBody;
      const next = { ...record, ...(record.status !== undefined ? { status: normalizeSessionStatus(record.status) } : {}) };
      await validateActiveFacultyForeignKeys(tenant, next);
      const before = await repo.findSessionById(tenant, id);
      if (!before) return null;
      const overridden = assertSessionEditable(before, { ...before, ...next } as Session, { ...lock, lockOverrideReason: lockOverrideReason ?? lock.lockOverrideReason });
      assertSessionDateRange({ ...before, ...next });
      const updated = await crud.updateById(id, next as SessionRecord);
      if (overridden.length > 0) {
        await recordModernAuditEvent({ workspaceSubdomain: tenant, tableName: 'sessions', recordId: id, actionType: 'UPDATE',
          newState: { lockOverride: overridden, reason: lockOverrideReason ?? lock.lockOverrideReason } });
      }
      return updated;
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
          throw new NotFoundError('Session is already archived');
        }
        throw new NotFoundError('Session not found');
      }
      await broadcastCollection('sessions');
      await broadcastCollection('enrollments');
      return true;
    },
    restoreSessionById: async (id: string, userId?: string): Promise<boolean> => {
      const tenant = getRequestTenant();
      if (!tenant) return false;
      const ok = await repo.restoreSessionWithCascade(tenant, id, userId);
      if (!ok) {
        const existing = await repo.findSessionById(tenant, id);
        if (existing && !existing.deletedAt) {
          throw new NotFoundError('Session is already active');
        }
        throw new NotFoundError('Session not found');
      }
      await broadcastCollection('sessions');
      await broadcastCollection('enrollments');
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
        await broadcastCollection('sessions');
        await broadcastCollection('enrollments');
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
        await broadcastCollection('sessions');
        await broadcastCollection('enrollments');
      }
      return res;
    },

    bulkUpdateSessionsStatus: async (
      ids: string[],
      status: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = getRequestTenant();
      if (!tenant) return { succeeded: 0, failed: ids.length };
      const target = normalizeSessionStatus(status);
      // Only allowed lifecycle transitions are applied; the rest count as failed.
      const current = await Promise.all(dedupeTrimmedIds(ids).map((sessionId) => repo.findSessionById(tenant, sessionId)));
      const allowed = current.filter((row): row is Session => Boolean(row) && canTransitionSession(String(row?.status), target)).map((row) => String(row.id));
      const result = allowed.length > 0 ? await repo.bulkUpdateSessionsStatus(tenant, allowed, target) : { succeeded: 0, failed: 0 };
      result.failed += ids.length - allowed.length;
      if (result.succeeded > 0) {
        await broadcastCollection('sessions');
      }
      return result;
    },

    loadSessionsPage: async (query: SessionsListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          sessions: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listSessionsPage(tenant, query);
    },

    loadSessionsByIds: async (ids: string[]): Promise<Session[]> => {
      const tenant = getRequestTenant();
      if (!tenant || ids.length === 0) return [];
      const matched = (await repo.findSessionsByIds(tenant, ids)) as Session[];
      return matched.filter((session) => !session.deletedAt);
    },

    countSessions: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countSessionsActive(tenant);
    },

    loadSessionsCommandMetrics: async () => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          total: 0,
          active: 0,
          upcoming: 0,
          completed: 0,
          cancelled: 0,
          totalEnrolled: 0,
          totalCapacity: 0,
          totalClasses: 0,
          sessionsThisWeek: 0,
          sessionsLastWeek: 0,
        };
      }
      return repo.aggregateSessionsCommandMetrics(tenant);
    },

    loadSessionsWidgetAggregates: async (
      queries: SessionsWidgetQuery[],
      _request?: unknown,
    ): Promise<Record<string, import('@mms/shared').SessionsWidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateSessionsWidgetQueries(tenant, queries);
    },

    loadSessionsReportAggregates: async (): Promise<SessionsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return { capacity: [], enrollmentTrends: [], todaysSessions: [] };
      }
      return repo.loadSessionsReportAggregates(tenant);
    },
  };
}

export const sessionsUseCases = createSessionsUseCases();
