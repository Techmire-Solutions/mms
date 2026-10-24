/**
 * @file facultyEmploymentEntityAudit.ts
 * @description Shared modern audit + outbox for employment / employ-designation rows.
 */
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import type { AppDb } from "../tenant-context.js";

type EmploymentEntityTable = "faculty_employments" | "faculty_employ_designations";

export async function auditEmploymentEntityUpdate(
  tx: AppDb,
  subdomain: string,
  tableName: EmploymentEntityTable,
  recordId: string,
  realUserId: string | null | undefined,
  newState: Record<string, unknown>,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName,
    recordId,
    actionType: "UPDATE",
    realUserId: realUserId ?? undefined,
    newState,
  });
}

export async function auditEmploymentEntitySoftDeletes(
  tx: AppDb,
  subdomain: string,
  tableName: EmploymentEntityTable,
  ids: string[],
  deletedBy: string,
  deletionReason: string | undefined,
  deletedAt: Date,
): Promise<void> {
  for (const id of ids) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName,
      recordId: id,
      actionType: "DELETE",
      realUserId: deletedBy,
      newState: { reason: deletionReason ?? null },
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: tableName,
      entityId: id,
      tenantId: subdomain,
      deletedAt: deletedAt.toISOString(),
      deletedBy,
      deletionReason,
      version: deletedAt.getTime(),
    });
  }
}

export async function auditEmploymentEntityRestores(
  tx: AppDb,
  subdomain: string,
  tableName: EmploymentEntityTable,
  ids: string[],
  restoredBy: string | undefined,
  restoredAt: Date,
): Promise<void> {
  for (const id of ids) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName,
      recordId: id,
      actionType: "RESTORE",
      realUserId: restoredBy,
    });
    await emitOutboxEvent(tx, "entity.restored", {
      entityType: tableName,
      entityId: id,
      tenantId: subdomain,
      restoredAt: restoredAt.toISOString(),
      restoredBy: restoredBy ?? "",
      version: restoredAt.getTime(),
    });
  }
}
