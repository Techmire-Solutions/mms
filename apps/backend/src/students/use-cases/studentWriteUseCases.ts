import { studentStatusEndsEnrollments, type StudentRecord, type User } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { activeDb, runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { canDeleteCollection } from "../../lib/rbacCanHelpers.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import {
  mergeStudentPatch,
  prepareStudentRecord,
  throwGrUniqueConflict,
  StudentPermissionError,
  StudentRestoreConflictError,
} from "./studentNormalizeUseCases.js";
import { recordRestoreEvents } from "./studentAuditEvents.js";
import { restoreCascadedEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";
import { loadStudentModulePreferences } from "./studentPreferencesService.js";
import { withdrawEnrollmentsForStudentStatus } from "../../enrollments/use-cases/enrollmentEndUseCases.js";

interface CreateStudentResult {
  record: StudentRecord;
  /** True when an archived student with the same contactId was restored instead of inserting. */
  restored: boolean;
}

interface CreateStudentOptions {
  user?: User;
}

/**
 * Creates a student. When the incoming record carries a `contactId` that matches a
 * soft-deleted student (re-registration), the archived row is restored in place —
 * its id/createdAt are preserved, deletion markers cleared, and incoming fields
 * overlaid (Contacts restore-on-create parity). Restoring requires delete
 * permission (Contacts parity).
 */
export async function createStudent(
  record: StudentRecord | Record<string, unknown>,
  options: CreateStudentOptions | User = {},
  repo: StudentsRepository = studentsRepository,
): Promise<CreateStudentResult> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const normalized = prepareStudentRecord(record);
    const contactId = normalized.contactId != null ? String(normalized.contactId).trim() : "";

    const user =
      options && "role" in options ? (options as User) : (options as CreateStudentOptions)?.user;
    const userId = user?.id ? String(user.id) : undefined;
    if (userId) {
      normalized.createdBy = normalized.createdBy ?? userId;
      normalized.updatedBy = normalized.updatedBy ?? userId;
    }

    if (contactId) {
      const archived = await repo.findSoftDeletedByContactId(tenant, contactId);
      if (archived) {
        if (!user || !canDeleteCollection(user, "students")) {
          throw new StudentPermissionError(
            "Restoring soft-deleted students requires delete permissions",
          );
        }
        const merged = prepareStudentRecord({
          ...archived,
          ...normalized,
          id: archived.id,
          restoredBy: userId,
          updatedBy: userId ?? normalized.updatedBy,
        });
        const conflict = await repo.findRegistrationConflict(tenant, {
          grNumber: merged.grNumber as string | undefined,
          excludeId: String(archived.id),
        });
        if (conflict === "grNumber") {
          throw new StudentRestoreConflictError();
        }
        if (merged.studentId?.trim() && repo.findActiveStudentIdOwners) {
          const activeSidOwners = await repo.findActiveStudentIdOwners(tenant, [
            merged.studentId.trim(),
          ]);
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
        return { record: merged, restored: true };
      }
    }

    if (!normalized.grNumber?.trim() && repo.generateNextGrNumber) {
      const prefs = await loadStudentModulePreferences();
      if (!prefs || prefs.autoGenerateId !== false) {
        const regDateStr =
          typeof normalized.registeredDate === "string" && normalized.registeredDate.trim()
            ? normalized.registeredDate.trim()
            : new Date().toISOString().slice(0, 10);
        normalized.grNumber = await repo.generateNextGrNumber(tenant, {
          regDate: regDateStr,
          settings: {
            grNumberTemplate: prefs?.grNumberTemplate ?? "{seq}-{year}",
            grNumberDigits: prefs?.grNumberDigits ?? 4,
            grNumberRestartAnnually: prefs?.grNumberRestartAnnually ?? true,
          },
        });
      }
    }

    try {
      await repo.save(tenant, normalized);
    } catch (error: unknown) {
      throwGrUniqueConflict(error);
    }
    return { record: normalized, restored: false };
  });
  await broadcastCollection("students");
  return result;
}

export async function updateStudentById(
  id: string,
  record: StudentRecord | Record<string, unknown>,
  options?: { user?: User; userId?: string } | User | StudentsRepository,
  repo: StudentsRepository = studentsRepository,
): Promise<StudentRecord | null> {
  const actualRepo =
    options && typeof (options as StudentsRepository).findById === "function"
      ? (options as StudentsRepository)
      : repo;
  const user =
    options && "role" in options
      ? (options as User)
      : options && "user" in options
        ? (options as { user?: User }).user
        : undefined;
  const userId = user?.id
    ? String(user.id)
    : options && "userId" in options
      ? (options as { userId?: string }).userId
      : undefined;

  let previousStatus: string | undefined;
  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await actualRepo.findById(tenant, id);
    if (!existing || existing.deletedAt) return null;
    previousStatus = existing.status;
    const patched = mergeStudentPatch(existing, record);
    const normalized = prepareStudentRecord({
      ...patched,
      id,
    });
    if (userId) {
      normalized.updatedBy = userId;
    }
    try {
      await actualRepo.save(tenant, normalized);
    } catch (error: unknown) {
      throwGrUniqueConflict(error);
    }
    return normalized;
  });
  if (saved) await broadcastCollection("students");
  const tenant = getRequestTenant();
  if (saved && tenant && studentStatusEndsEnrollments(previousStatus, saved.status)) {
    await withdrawEnrollmentsForStudentStatus(
      tenant,
      id,
      String(saved.status),
      user ? { userId: String(user.id), label: user.name || user.email } : undefined,
    );
  }
  return saved;
}
