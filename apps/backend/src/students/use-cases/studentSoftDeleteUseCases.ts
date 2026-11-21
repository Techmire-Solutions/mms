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
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";

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
  // Dedupe first: the SQL layer dedupes too, so a repeated id previously inflated `succeeded` and
  // wrote duplicate DELETE audit/outbox rows for the same student.
  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: uniqueIds.length };
    if (repo.guardDeleteDependents) {
      await repo.guardDeleteDependents(tenant, uniqueIds);
    }
    let succeeded = 0;
    let failed = 0;
    const now = nowIso();
    const trimmedReason = deletionReason?.trim();
    const toSave: Student[] = [];

    const existingStudents = await repo.findByIds(tenant, uniqueIds);
    const existingMap = new Map(existingStudents.map((student) => [String(student.id), student]));

    for (const id of uniqueIds) {
      const existing = existingMap.get(String(id));
      if (existing && !existing.deletedAt) {
        toSave.push({
          ...existing,
          deletedAt: now,
          deletedBy,
          deletionReason: trimmedReason || undefined,
        });
      } else {
        failed += 1;
      }
    }

    if (toSave.length > 0) {
      // Only rows this request actually wrote may be cascaded or audited. The single-statement
      // UPDATE can skip a row a concurrent writer already deleted/restored; the pre-read snapshot
      // must not fabricate DELETE audit/outbox evidence for it.
      let written = toSave;
      if (repo.bulkSoftDelete) {
        const write = await repo.bulkSoftDelete(
          tenant,
          toSave.map((s) => String(s.id)),
          deletedBy,
          trimmedReason,
        );
        written = write.deletedIds
          ? toSave.filter((s) => write.deletedIds!.includes(String(s.id)))
          : toSave.slice(0, write.succeeded);
        succeeded = write.succeeded;
        failed = uniqueIds.length - write.succeeded;
      } else {
        await repo.bulkSave(tenant, toSave);
        succeeded = toSave.length;
        failed = uniqueIds.length - succeeded;
      }
      if (written.length === 0) {
        return { succeeded, failed };
      }

      await cascadeSoftDeleteEnrollmentsForStudents(
        activeDb(),
        tenant,
        written.map((s) => String(s.id)),
        deletedBy,
        trimmedReason,
        new Date(now),
      );

      for (const s of written) {
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
          subjectId: String(s.id),
          oldState: s,
          minimizeDelta: false,
        });
      }
      await reconcileContactSystemTags(
        tenant,
        written.flatMap((s) => [
          s.contactId,
          s.fatherContactId,
          s.motherContactId,
          s.guardianContactId,
        ]),
        { actorId: deletedBy },
      );
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
