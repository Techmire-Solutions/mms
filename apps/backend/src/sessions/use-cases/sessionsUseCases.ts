import type { SessionsRepository } from "../repository/sessionsRepository.js";
import { sessionsRepository } from "../repository/sessionsRepositoryAdapter.js";
import { getRequestTenant, getRequestUserId } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { ConflictError, HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import { isIsoUtcTimestamp } from "../../lib/occHeaders.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  assertSessionEditable,
  workspaceToday,
  type SessionLockContext,
  assertSessionDateRange,
} from "./sessionLockGuard.js";
import { transitionSession } from "./sessionTransitionService.js";
import { createSessionTrashUseCases } from "./sessionTrashUseCases.js";
import { withTenant } from "../../db/tenant-context.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { sessionDateBoundsTx } from "../repository/sessionTransitionRepositoryAdapter.js";
import { createSessionReadUseCases } from "./sessionReadUseCases.js";
import {
  assertSessionOverlapFree,
  loadSessionOverlapExemption,
  type OverlapGuardDependencies,
} from "./sessionOverlapGuard.js";
import {
  endDateBoundViolations,
  sessionRecordSchema,
  type SessionRecord,
  type SessionCreateBody,
  type SessionUpdateBody,
} from "@mms/shared";
import {
  dedupeTrimmedIds,
  normalizeSessionStatus,
  normalizeStoredSession,
  type Session,
} from "@mms/shared";

interface SessionsUseCasesDependencies extends OverlapGuardDependencies {
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
      // A session is born as a draft or an open intake; every later state must be reached through
      // `transitionSession`, otherwise the lifecycle machine is bypassed at creation time.
      const birthStatus = normalizeSessionStatus(record.status);
      if (birthStatus !== "draft" && birthStatus !== "open")
        throw new ValidationError(
          `A session starts as draft or open, not ${birthStatus}; move it through the lifecycle instead`,
        );
      // `allowOverlap` is materialised per row; when it is off, overlapping live sessions are refused.
      const allowOverlap = await loadSessionOverlapExemption(tenant, deps);
      await assertSessionOverlapFree(
        repo,
        tenant,
        { ...record, overlapExempt: allowOverlap },
        allowOverlap,
      );
      return crud.create({
        ...record,
        overlapExempt: allowOverlap,
        status: birthStatus,
      } as SessionRecord);
    },
    updateSessionById: async (
      id: string,
      body: SessionUpdateBody | Partial<SessionRecord>,
      lock: SessionLockContext = { canOverrideLock: false },
      expectedUpdatedAt?: string,
      expectedVersion?: number,
    ): Promise<SessionRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const expected = expectedUpdatedAt?.trim();
      // Strict ISO-8601 UTC: `Date.parse` would also accept offset-less values and parse them in
      // the server's timezone, turning a client timestamp into a different instant.
      if (expected && !isIsoUtcTimestamp(expected))
        throw new ValidationError(
          "x-expected-updated-at must be an ISO-8601 UTC timestamp (for example 2026-03-01T10:00:00.000Z)",
        );
      if (expectedVersion !== undefined && !Number.isInteger(expectedVersion))
        throw new ValidationError("Invalid x-expected-version header");
      const { lockOverrideReason, cancellationReason, ...record } = body as SessionUpdateBody;
      const next = {
        ...record,
        ...(record.status !== undefined ? { status: normalizeSessionStatus(record.status) } : {}),
      };
      await validateActiveFacultyForeignKeys(tenant, next);
      const before = await repo.findSessionById(tenant, id);
      if (!before || before.deletedAt) return null;
      const today = lock.today ?? (await workspaceToday(tenant));
      // The end date may only shrink when no recorded teaching/enrollment falls after the new day.
      const endDateBounds =
        next.endDate !== undefined && (next.endDate ?? "") < (before.endDate ?? "")
          ? await withTenant(tenant, (tx) => sessionDateBoundsTx(tx, tenant, id))
          : null;
      const extraViolations = endDateBounds
        ? endDateBoundViolations({
            previousEndDate: before.endDate,
            nextEndDate: next.endDate,
            lastAttendanceDate: endDateBounds.lastAttendanceDate,
            lastEnrollmentEnd: endDateBounds.lastEnrollmentDate,
            today,
          })
        : [];
      const overridden = assertSessionEditable(
        before,
        { ...before, ...next } as Session,
        {
          ...lock,
          today,
          lockOverrideReason: lockOverrideReason ?? lock.lockOverrideReason,
        },
        extraViolations,
      );
      assertSessionDateRange({ ...before, ...next });
      // A PUT without a concurrency token is an unconditional overwrite — refuse it instead of
      // silently losing a concurrent edit (mms-api-interface §6). Checked after payload validation
      // so an invalid body still reports its own 400 rather than a precondition error.
      if (!expected && expectedVersion === undefined)
        throw new HttpDomainError(
          428,
          "precondition_required",
          "Send x-expected-version (or x-expected-updated-at) with the value you read before saving",
        );
      const allowOverlap = await loadSessionOverlapExemption(tenant, deps);
      await assertSessionOverlapFree(
        repo,
        tenant,
        { ...before, ...next, overlapExempt: allowOverlap },
        allowOverlap,
      );

      const merged: Record<string, unknown> = { ...before };
      for (const [key, value] of Object.entries(next)) {
        if (value !== undefined) merged[key] = value;
      }
      merged.overlapExempt = allowOverlap;
      const normalized = normalizeStoredSession(
        sessionRecordSchema.parse({ ...merged, id }),
      ) as SessionRecord;
      const currentStatus = normalizeSessionStatus(before.status);
      const targetStatus =
        next.status !== undefined && next.status !== currentStatus ? next.status : undefined;
      // Content is persisted in the current state; the transition below applies the new state with
      // its guards/side effects, so a rejected transition rolls the whole request back.
      normalized.status = currentStatus;
      // The version predicate lives in the repository's row-locked write (OCC 409).
      const occOptions = {
        ...(expected ? { expectedUpdatedAt: expected } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
      };
      const savedUpdatedAt = await repo.saveSession(
        tenant,
        normalized,
        Object.keys(occOptions).length > 0 ? occOptions : undefined,
      );
      normalized.updatedAt = savedUpdatedAt;
      normalized.version = Number(before.version ?? 1) + 1;
      runAfterCommit(() => broadcastCollection("sessions"));
      runAfterCommit(() =>
        invalidateMultiTierCache({ tenantId: tenant, domain: "sessions", key: id }),
      );
      let result: SessionRecord = normalized;
      if (targetStatus) {
        const transition = await transitionSession(tenant, id, {
          to: targetStatus,
          reason: cancellationReason ?? lockOverrideReason ?? lock.lockOverrideReason,
          actor: { userId: getRequestUserId() ?? null },
          canOverride: lock.canOverrideLock,
        });
        result = transition.session;
      }
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
      return result;
    },

    ...createSessionTrashUseCases(repo),
  };
}

export const sessionsUseCases = createSessionsUseCases();
