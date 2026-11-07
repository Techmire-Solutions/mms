import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
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
import { throwOverlapConflict } from "./sessionPersistErrors.js";
import { overlapExemptForRestoreTx, type SaveSessionOptions } from "./sessionRepositoryDates.js";
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

