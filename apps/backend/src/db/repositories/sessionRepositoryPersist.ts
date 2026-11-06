import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { normalizeSessionStatus, type Session } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { sessions, sessionFaculty } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { persistSessionClassesTx } from "./sessionRepositoryPersistClasses.js";
import { resolveSessionCatalogRefsTx } from "./sessionCatalogRefs.js";
import { replaceSessionWorkingDaysTx } from "./sessionWorkingDays.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { toDbDate } from "../../lib/dbDate.js";
import { getRequestUserId } from "../../lib/tenantContext.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isExclusionViolation } from "../../lib/pgErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

export {
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
  hardDeleteSession,
  bulkDeleteSessions,
  bulkRestoreSessions,
  bulkSoftDeleteSessionsWithCascade,
  bulkRestoreSessionsWithCascade,
} from "./sessionRepositoryCascade.js";

type Transaction = TenantTransaction;

/**
 * The exclusion constraint is the authority (migration 0206); translate its `23P01` into a 409 so
 * callers that bypass the use-case guard (imports, rollover, lifecycle ops) still get an
 * actionable message instead of a database error.
 */
function throwOverlapConflict(error: unknown): never {
  if (isExclusionViolation(error)) {
    throw new ConflictError(
      'These dates overlap another live session. Close or archive it first, or enable "Allow overlapping sessions" in Sessions → Setup → Preferences.',
    );
  }
  throw error;
}

function sessionWriteValues(subdomain: string, record: Session): typeof sessions.$inferInsert {
  return {
    id: String(record.id),
    workspaceSubdomain: subdomain,
    name: record.name,
    categoryId: record.categoryId || null,
    programId: record.programId || null,
    status: normalizeSessionStatus(record.status),
    startDate: toDbDate(record.startDate),
    endDate: toDbDate(record.endDate),
    baseFee: String(record.baseFee ?? 0),
    currency: record.currency ?? "PKR",
    description: record.description ?? null,
    minAttendancePct: record.minAttendancePct ?? null,
    requiresExamPass: record.requiresExamPass ?? false,
    // `allowOverlap` preference materialised at write time (migration 0206).
    overlapExempt: record.overlapExempt ?? false,
    ...(record.createdAt ? { createdAt: new Date(record.createdAt) } : {}),
  };
}

function sessionUpdateSetValues(subdomain: string, record: Session) {
  const {
    id: _id,
    workspaceSubdomain: _subdomain,
    createdAt: _createdAt,
    ...setFields
  } = sessionWriteValues(subdomain, record);
  return setFields;
}

/**
 * Soft-delete columns are written only by the explicit lifecycle paths (delete/restore/purge) and
 * by a backup restore (`policy: "payload"`). A normal save must never clear `deleted_at` — that is
 * an unattributed resurrection that also resets `deleted_with_cascade` (`mms-soft-delete` §5).
 */
function softDeleteWriteValues(record: Session) {
  return {
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    restoredAt: record.restoredAt ? new Date(record.restoredAt) : null,
    restoredBy: record.restoredBy ?? null,
    deletedWithCascade: Boolean(record.deletedWithCascade),
  };
}

interface SaveSessionOptions {
  /**
   * Optimistic-concurrency token: the `updatedAt` the caller read. Compared under a row lock
   * inside the write transaction, so a writer that commits after our read cannot be silently
   * overwritten (`mms-api-interface.md` §6).
   */
  expectedUpdatedAt?: string;
  /**
   * Monotonic OCC token (preferred over `expectedUpdatedAt`): `sessions.version` is incremented by
   * every write, so two writes inside the same millisecond can no longer share a token.
   */
  expectedVersion?: number;
  /**
   * `preserve` (default) leaves the soft-delete sextuple untouched; `payload` mirrors it from the
   * record — only the backup-restore replace path may do this.
   */
  softDelete?: "preserve" | "payload";
  /** Actor stamped on `restored_at`/`restored_by` when a `payload` write clears `deleted_at`. */
  restoredBy?: string;
}

async function persistSessionTx(
  tx: Transaction,
  subdomain: string,
  input: Session,
  options?: SaveSessionOptions,
): Promise<string> {
  const record = await resolveSessionCatalogRefsTx(tx, subdomain, input);
  const now = new Date();
  record.updatedAt = now.toISOString();
  const sessionId = String(record.id);

  // Row lock serialises concurrent writers for the whole aggregate replacement below.
  const [existing] = await tx
    .select({
      id: sessions.id,
      updatedAt: sessions.updatedAt,
      version: sessions.version,
      deletedAt: sessions.deletedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, sessionId)))
    .for("update");

  const expectedVersion = options?.expectedVersion;
  const expected = options?.expectedUpdatedAt?.trim();
  if (expectedVersion !== undefined) {
    if (!existing) throw new ConflictError("This session no longer exists — reload and try again");
    if (Number(existing.version) !== Number(expectedVersion))
      throw new ConflictError("This session was modified by another user — reload and try again");
  } else if (expected) {
    const expectedIso = new Date(expected).toISOString();
    if (!existing) throw new ConflictError("This session no longer exists — reload and try again");
    if (existing.updatedAt.toISOString() !== expectedIso)
      throw new ConflictError("This session was modified by another user — reload and try again");
  }

  const payloadSoftDelete =
    options?.softDelete === "payload" ? softDeleteWriteValues(record) : undefined;
  // Restoring a trashed row through the payload path must carry provenance, never a bare clear.
  const resurrectionProvenance =
    payloadSoftDelete && existing?.deletedAt && !payloadSoftDelete.deletedAt
      ? { restoredAt: now, restoredBy: options?.restoredBy ?? null }
      : undefined;

  // 1. Upsert session row. `version` advances on every write; it is the OCC token callers echo.
  try {
    await tx
      .insert(sessions)
      .values({
        ...sessionWriteValues(subdomain, record),
        updatedAt: now,
        ...(payloadSoftDelete ?? {}),
      })
      .onConflictDoUpdate({
        target: [sessions.workspaceSubdomain, sessions.id],
        set: {
          ...sessionUpdateSetValues(subdomain, record),
          updatedAt: now,
          version: sql`${sessions.version} + 1`,
          ...(payloadSoftDelete ?? {}),
          ...(resurrectionProvenance ?? {}),
        },
      });
  } catch (error) {
    throwOverlapConflict(error);
  }

  await replaceSessionWorkingDaysTx(tx, subdomain, sessionId, record.workingDays);

  // 2. Persist Session Faculty
  await tx
    .delete(sessionFaculty)
    .where(
      and(
        eq(sessionFaculty.workspaceSubdomain, subdomain),
        eq(sessionFaculty.sessionId, sessionId),
      ),
    );

  if (record.faculty && record.faculty.length > 0) {
    await tx.insert(sessionFaculty).values(
      record.faculty.map((f) => ({
        id: f.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionId,
        facultyId: f.facultyId,
        facultyName: f.facultyName || "",
        role: f.role || "coordinator",
        status: f.status || "active",
      })),
    );
  }

  // 3. Clear existing classes and insert new classes
  await persistSessionClassesTx(tx, subdomain, sessionId, record.classes);

  // 4. Every create/update is audited on the same transaction (override audit stays separate).
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: "sessions",
    recordId: sessionId,
    actionType: existing ? "UPDATE" : "CREATE",
    realUserId: getRequestUserId() ?? undefined,
    newState: record,
  });
  return now.toISOString();
}

export async function saveSession(
  tenant: string,
  record: Session,
  options?: SaveSessionOptions,
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const updatedAt = await withTenant(subdomain, async (tx) =>
    persistSessionTx(tx, subdomain, record, options),
  );
  await invalidateMultiTierCache({
    tenantId: subdomain,
    domain: "sessions",
    key: String(record.id),
  });
  return updatedAt;
}

export async function bulkSaveSessions(tenant: string, records: Session[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    for (const record of records) {
      await persistSessionTx(tx, subdomain, record);
    }
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions" });
}

/**
 * Backup-restore replace: upserts the payload and **archives** sessions the backup does not
 * contain. It must never hard-delete: `sessions` owns enrollments, attendance and fee history
 * through FKs (`sessions_no_overlap_excl` plus the 0206 FK hardening), and a cascade here is a
 * silent data-loss path. Archived rows stay restorable from the trash.
 */
export async function replaceSessionsForWorkspace(
  tenant: string,
  records: Session[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const restoredBy = getRequestUserId() ?? undefined;
  const now = new Date();
  await withTenant(subdomain, async (tx) => {
    const keepIds = records.map((record) => String(record.id));
    const staleScope = [
      eq(sessions.workspaceSubdomain, subdomain),
      isNull(sessions.deletedAt),
      ...(keepIds.length > 0 ? [notInArray(sessions.id, keepIds)] : []),
    ];
    const stale = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(...staleScope));
    if (stale.length > 0) {
      await tx
        .update(sessions)
        .set({
          deletedAt: now,
          deletedBy: restoredBy ?? null,
          deletionReason: "Archived by backup restore (not present in the backup)",
          updatedAt: now,
          version: sql`${sessions.version} + 1`,
        })
        .where(and(...staleScope));
    }
    for (const record of records) {
      const overlapExempt = await overlapExemptForRestoreTx(tx, subdomain, record);
      await persistSessionTx(tx, subdomain, { ...record, overlapExempt }, { softDelete: "payload", restoredBy });
    }
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions" });
}

/**
 * A backup written before migration 0206 may contain overlapping live sessions. Restoring it must
 * not fail on the exclusion constraint, so the conflicting rows are restored as `overlap_exempt`
 * (visible and correctable) instead of aborting the whole restore.
 */
async function overlapExemptForRestoreTx(
  tx: TenantTransaction,
  subdomain: string,
  record: Session,
): Promise<boolean> {
  if (record.overlapExempt) return true;
  if (!["draft", "open", "in_progress"].includes(normalizeSessionStatus(record.status))) return false;
  const start = toDbDate(record.startDate);
  const end = toDbDate(record.endDate);
  if (!start || !end) return false;
  const [conflict] = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.workspaceSubdomain, subdomain),
        isNull(sessions.deletedAt),
        eq(sessions.overlapExempt, false),
        inArray(sessions.status, ["draft", "open", "in_progress"]),
        isNotNull(sessions.startDate),
        isNotNull(sessions.endDate),
        sql`daterange(${sessions.startDate}, ${sessions.endDate}, '[]') && daterange(${start}::date, ${end}::date, '[]')`,
      ),
    )
    .limit(1);
  return Boolean(conflict);
}

/**
 * Targeted date update for `postpone`. Unlike `saveSession` (a whole-aggregate replacement),
 * this cannot lose a concurrent edit to classes/faculty and still honours the OCC token.
 */
export async function updateSessionDates(
  tenant: string,
  id: string,
  dates: { startDate: string | null; endDate: string | null },
  options?: SaveSessionOptions,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const changed = await withTenant(subdomain, async (tx) => {
    const scope = and(
      eq(sessions.workspaceSubdomain, subdomain),
      eq(sessions.id, id),
      isNull(sessions.deletedAt),
    );
    const [existing] = await tx
      .select({ updatedAt: sessions.updatedAt, version: sessions.version })
      .from(sessions)
      .where(scope)
      .for("update");
    if (!existing) return false;
    if (options?.expectedVersion !== undefined) {
      if (Number(existing.version) !== Number(options.expectedVersion))
        throw new ConflictError("This session was modified by another user — reload and try again");
    } else {
      const expected = options?.expectedUpdatedAt?.trim();
      if (expected && existing.updatedAt.toISOString() !== new Date(expected).toISOString())
        throw new ConflictError("This session was modified by another user — reload and try again");
    }
    try {
      await tx
        .update(sessions)
        .set({
          startDate: toDbDate(dates.startDate),
          endDate: toDbDate(dates.endDate),
          updatedAt: new Date(),
          version: sql`${sessions.version} + 1`,
        })
        .where(scope);
    } catch (error) {
      throwOverlapConflict(error);
    }
    return true;
  });
  if (changed) {
    await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions", key: id });
  }
  return changed;
}
