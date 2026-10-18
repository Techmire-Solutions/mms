import { and, eq } from "drizzle-orm";
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

export function sessionWriteValues(
  subdomain: string,
  record: Session,
): typeof sessions.$inferInsert {
  return {
    id: String(record.id),
    workspaceSubdomain: subdomain,
    name: record.name,
    type: record.type || "academic",
    categoryId: record.categoryId || null,
    programId: record.programId || null,
    status: normalizeSessionStatus(record.status),
    startDate: toDbDate(record.startDate),
    endDate: toDbDate(record.endDate),
    baseFee: String(record.baseFee ?? 0),
    currency: record.currency ?? "PKR",
    description: record.description ?? null,
    ...mapAuditToInsert(record),
  };
}

export function sessionUpdateSetValues(subdomain: string, record: Session) {
  const {
    id: _id,
    workspaceSubdomain: _subdomain,
    createdAt: _createdAt,
    ...setFields
  } = sessionWriteValues(subdomain, record);
  return setFields;
}

async function persistSessionTx(tx: Transaction, subdomain: string, input: Session): Promise<void> {
  const record = await resolveSessionCatalogRefsTx(tx, subdomain, input);
  const sessionId = String(record.id);

  // 1. Upsert session row
  await tx
    .insert(sessions)
    .values(sessionWriteValues(subdomain, record))
    .onConflictDoUpdate({
      target: [sessions.workspaceSubdomain, sessions.id],
      set: sessionUpdateSetValues(subdomain, record),
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
}

export async function saveSession(tenant: string, record: Session): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await persistSessionTx(tx, subdomain, record);
  });
  await invalidateMultiTierCache({
    tenantId: subdomain,
    domain: "sessions",
    key: String(record.id),
  });
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
