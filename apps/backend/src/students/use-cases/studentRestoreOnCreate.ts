import { type Student, type StudentRecord, type User } from "@mms/shared";
import { activeDb } from "../../db/database.js";
import { canDeleteCollection } from "../../lib/rbacCanHelpers.js";
import { buildRestoredRecord } from "../../lib/softDeleteHelpers.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import {
  prepareStudentRecord,
  StudentPermissionError,
  StudentRestoreConflictError,
} from "./studentNormalizeUseCases.js";
import { recordRestoreEvents } from "./studentAuditEvents.js";
import { restoreCascadedEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";

interface RestoreArchivedStudentInput {
  tenant: string;
  archived: Student;
  incoming: StudentRecord;
  user?: User;
  userId?: string;
  repo: StudentsRepository;
}

/**
 * Restores a soft-deleted student in place (same id) for a re-registration.
 *
 * Shared by both create-time collisions — an archived row matching the payload `contactId`, and an
 * archived row matching the client-supplied `id` — so both enforce the same delete permission, run
 * the same GR/Student-ID/contact conflict probes, persist restore provenance, restore
 * cascade-deleted enrollments, and write the restore audit/outbox events.
 */
export async function restoreArchivedStudentOnCreate({
  tenant,
  archived,
  incoming,
  user,
  userId,
  repo,
}: RestoreArchivedStudentInput): Promise<StudentRecord> {
  if (!user || !canDeleteCollection(user, "students")) {
    throw new StudentPermissionError("Restoring soft-deleted students requires delete permissions");
  }
  const pending = prepareStudentRecord({ ...archived, ...incoming, id: archived.id });
  const merged = buildRestoredRecord(
    pending as unknown as Record<string, unknown>,
    userId,
  ) as unknown as StudentRecord;
  if (userId) merged.updatedBy = userId;

  const conflict = await repo.findRegistrationConflict(tenant, {
    grNumber: merged.grNumber?.trim() || undefined,
    contactId: merged.contactId ? String(merged.contactId) : undefined,
    excludeId: String(archived.id),
  });
  if (conflict === "grNumber") throw new StudentRestoreConflictError();
  if (conflict === "contact") {
    throw new StudentRestoreConflictError("A student with this contact already exists", "contact");
  }
  if (merged.studentId?.trim() && repo.findActiveStudentIdOwners) {
    const activeSidOwners = await repo.findActiveStudentIdOwners(tenant, [merged.studentId.trim()]);
    const normalizedSid = merged.studentId.trim().toLowerCase();
    const activeOwner = activeSidOwners.get(normalizedSid);
    if (activeOwner && activeOwner !== String(archived.id)) {
      throw new StudentRestoreConflictError(
        "A student with this Student ID already exists",
        "studentId",
      );
    }
  }

  await repo.save(tenant, merged);
  const restoredAt =
    typeof merged.restoredAt === "string" && merged.restoredAt
      ? merged.restoredAt
      : new Date().toISOString();
  await restoreCascadedEnrollmentsForStudents(
    activeDb(),
    tenant,
    [String(archived.id)],
    userId,
    new Date(restoredAt),
  );
  await recordRestoreEvents(tenant, merged, restoredAt, userId);
  await reconcileContactSystemTags(
    tenant,
    [merged.contactId, merged.fatherContactId, merged.motherContactId, merged.guardianContactId],
    { actorId: userId },
  );
  return merged;
}
