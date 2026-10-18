import type { Student } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { activeDb, runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { buildStudentForensicSnapshot } from "../../services/forensicSnapshotService.js";
import { nowIso } from "../../lib/softDeleteHelpers.js";
import { cascadeSoftDeleteEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export async function softDeleteStudentById(
  id: string,
  deletedBy: string,
  deletionReason?: string,
  repo: StudentsRepository = studentsRepository,
): Promise<boolean> {
  const result = await bulkSoftDeleteStudents([id], deletedBy, deletionReason, repo);
  return result.succeeded === 1;
}

export async function bulkSoftDeleteStudents(
  ids: string[],
  deletedBy: string,
  deletionReason?: string,
  repo: StudentsRepository = studentsRepository,
): Promise<{ succeeded: number; failed: number }> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: ids.length };
    if (repo.guardDeleteDependents) {
      await repo.guardDeleteDependents(tenant, ids);
    }
    let succeeded = 0;
    let failed = 0;
    const now = nowIso();
    const trimmedReason = deletionReason?.trim();
    const toSave: Student[] = [];

    const existingStudents = await repo.findByIds(tenant, ids);
    const existingMap = new Map(existingStudents.map((student) => [String(student.id), student]));

    for (const id of ids) {
      const existing = existingMap.get(String(id));
      if (existing && !existing.deletedAt) {
        toSave.push({
          ...existing,
          deletedAt: now,
          deletedBy,
          deletionReason: trimmedReason || undefined,
        });
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    if (toSave.length > 0) {
      if (repo.bulkSoftDelete) {
        await repo.bulkSoftDelete(
          tenant,
          toSave.map((s) => String(s.id)),
          deletedBy,
          trimmedReason,
        );
      } else {
        await repo.bulkSave(tenant, toSave);
      }
      await cascadeSoftDeleteEnrollmentsForStudents(
        activeDb(),
        tenant,
        toSave.map((s) => String(s.id)),
        deletedBy,
        trimmedReason,
        new Date(now),
      );

      for (const s of toSave) {
        await emitOutboxEvent("entity.soft_deleted", {
          entityType: "students",
          entityId: String(s.id),
          tenantId: tenant,
          deletedAt: s.deletedAt ?? now,
          deletedBy: deletedBy,
          deletionReason: s.deletionReason,
          version: Date.now(),
          snapshot: buildStudentForensicSnapshot(s),
        });
        await recordModernAuditEvent({
          workspaceSubdomain: tenant,
          tableName: "students",
          recordId: String(s.id),
          actionType: "DELETE",
          oldState: s,
          minimizeDelta: false,
        });
      }
    }
    return { succeeded, failed };
  });
  if (result.succeeded > 0) {
    const tenant = getRequestTenant();
    if (tenant) await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
  }
  return result;
}
