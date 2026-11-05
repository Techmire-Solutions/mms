import { and, eq, isNull } from "drizzle-orm";
import { normalizeSessionStatus, type Session } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { sessions, sessionFaculty } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { mapAuditToInsert } from "./repositoryMappers.js";
import { persistSessionClassesTx } from "./sessionRepositoryPersistClasses.js";
import { resolveSessionCatalogRefsTx } from "./sessionCatalogRefs.js";
import { replaceSessionWorkingDaysTx } from "./sessionWorkingDays.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { toDbDate } from "../../lib/dbDate.js";
import { getRequestUserId } from "../../lib/tenantContext.js";
import { ConflictError } from "../../lib/httpErrors.js";
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
    ...mapAuditToInsert(record),
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

interface SaveSessionOptions {
  /**
   * Optimistic-concurrency token: the `updatedAt` the caller read. Compared under a row lock
   * inside the write transaction, so a writer that commits after our read cannot be silently
   * overwritten (`mms-api-interface.md` §6).
   */
  expectedUpdatedAt?: string;
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
    .select({ id: sessions.id, updatedAt: sessions.updatedAt })
    .from(sessions)
    .where(and(eq(sessions.workspaceSubdomain, subdomain), eq(sessions.id, sessionId)))
    .for("update");

  const expected = options?.expectedUpdatedAt?.trim();
  if (expected) {
    const expectedIso = new Date(expected).toISOString();
    if (!existing) throw new ConflictError("This session no longer exists — reload and try again");
    if (existing.updatedAt.toISOString() !== expectedIso)
      throw new ConflictError("This session was modified by another user — reload and try again");
  }

  // 1. Upsert session row
  await tx
    .insert(sessions)
    .values({ ...sessionWriteValues(subdomain, record), updatedAt: now })
    .onConflictDoUpdate({
      target: [sessions.workspaceSubdomain, sessions.id],
      set: { ...sessionUpdateSetValues(subdomain, record), updatedAt: now },
    });

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

export async function replaceSessionsForWorkspace(
  tenant: string,
  records: Session[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(sessions).where(eq(sessions.workspaceSubdomain, subdomain));
    for (const record of records) {
      await persistSessionTx(tx, subdomain, record);
    }
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions" });
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
      .select({ updatedAt: sessions.updatedAt })
      .from(sessions)
      .where(scope)
      .for("update");
    if (!existing) return false;
    const expected = options?.expectedUpdatedAt?.trim();
    if (expected && existing.updatedAt.toISOString() !== new Date(expected).toISOString())
      throw new ConflictError("This session was modified by another user — reload and try again");
    await tx
      .update(sessions)
      .set({
        startDate: toDbDate(dates.startDate),
        endDate: toDbDate(dates.endDate),
        updatedAt: new Date(),
      })
      .where(scope);
    return true;
  });
  if (changed) {
    await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions", key: id });
  }
  return changed;
}
