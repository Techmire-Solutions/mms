import type { Student, StudentRecord } from "@mms/shared";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/** Emits CDC outbox event and writes modern audit event for student restore actions. */
export async function recordRestoreEvents(
  tenant: string,
  student: Student | StudentRecord,
  restoredAt: string,
  userId?: string,
): Promise<void> {
  const entityId = String(student.id ?? "");
  await emitOutboxEvent("entity.restored", {
    entityType: "students",
    entityId,
    tenantId: tenant,
    restoredAt,
    restoredBy: userId ?? "unknown",
    version: Date.now(),
  });
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "students",
    recordId: entityId,
    actionType: "RESTORE",
    newState: student,
    minimizeDelta: false,
  });
}
