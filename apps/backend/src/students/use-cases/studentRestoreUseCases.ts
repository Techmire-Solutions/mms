import type { Student } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { activeDb, runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import { StudentRestoreConflictError } from "./studentNormalizeUseCases.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { recordRestoreEvents } from "./studentAuditEvents.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { buildRestoredRecord, enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { restoreCascadedEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";

interface StudentBulkRestoreConflict {
  id: string;
  errors: Array<{ field: string; message: string }>;
}
interface StudentBulkRestoreResult {
  succeeded: number;
  failed: number;
  conflicts: StudentBulkRestoreConflict[];
}

const isPgUnique = (err: unknown): boolean =>
  isUniqueViolation(err) ||
  (typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "23505");

export async function restoreStudentById(
  id: string,
  userId?: string,
  repo: StudentsRepository = studentsRepository,
): Promise<Student | null> {
  const restored = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    await enableIncludeDeleted(activeDb());
    const existing = await repo.findById(tenant, id, { includeDeleted: true });
    if (!existing) return null;
    if (!existing.deletedAt) return existing;

    const conflict = await repo.findRegistrationConflict(tenant, {
      excludeId: id,
      grNumber: existing.grNumber,
      contactId: existing.contactId,
    });
    if (conflict === "grNumber") throw new StudentRestoreConflictError();
    if (conflict === "contact") {
      throw new StudentRestoreConflictError(
        "A student with this contact already exists",
        "contact",
      );
    }
    if (existing.studentId?.trim() && repo.findActiveStudentIdOwners) {
      const activeOwners = await repo.findActiveStudentIdOwners(tenant, [
        existing.studentId.trim(),
      ]);
      const normalizedSid = existing.studentId.trim().toLowerCase();
      const activeOwner = activeOwners.get(normalizedSid);
      if (activeOwner && activeOwner !== String(id)) {
        throw new StudentRestoreConflictError(
          "A student with this Student ID already exists",
          "studentId",
        );
      }
    }

    const next = buildRestoredRecord(existing, userId);
    try {
      await repo.save(tenant, next);
    } catch (err: unknown) {
      if (isPgUnique(err)) {
        const msg = String((err as { message?: unknown })?.message ?? "").toLowerCase();
        if (msg.includes("student_id")) {
          throw new StudentRestoreConflictError(
            "A student with this Student ID already exists",
            "studentId",
          );
        }
        throw new StudentRestoreConflictError();
      }
      throw err;
    }

    const restoredAt = next.restoredAt ?? new Date().toISOString();
    await restoreCascadedEnrollmentsForStudents(
      activeDb(),
      tenant,
      [String(id)],
      userId,
      new Date(restoredAt),
    );
    await recordRestoreEvents(tenant, next, restoredAt, userId);
    return next;
  });
  if (restored) {
    const tenant = getRequestTenant();
    if (tenant) await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
  }
  return restored;
}

export async function bulkRestoreStudents(
  ids: string[],
  userId?: string,
  repo: StudentsRepository = studentsRepository,
): Promise<StudentBulkRestoreResult> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return { succeeded: 0, failed: ids.length, conflicts: [] };
    await enableIncludeDeleted(activeDb());
    let succeeded = 0;
    let failed = 0;
    const conflicts: StudentBulkRestoreConflict[] = [];
    const toSave: Student[] = [];

    const existingStudents = await repo.findByIds(tenant, ids, { includeDeleted: true });
    const existingMap = new Map(existingStudents.map((student) => [String(student.id), student]));
    const acceptedGrNumbers = new Set<string>();
    const acceptedContactIds = new Set<string>();
    const acceptedStudentIds = new Set<string>();
    const candidateGrs = existingStudents
      .filter((s) => s.deletedAt && s.grNumber?.trim())
      .map((s) => String(s.grNumber));
    const candidateStudentIds = existingStudents
      .filter((s) => s.deletedAt && s.studentId?.trim())
      .map((s) => String(s.studentId));
    const [activeGrOwners, activeContactsList, activeStudentIdOwners] = await Promise.all([
      repo.findActiveGrNumberOwners(tenant, candidateGrs),
      repo.listLinkedContactIds ? repo.listLinkedContactIds(tenant) : Promise.resolve([]),
      repo.findActiveStudentIdOwners
        ? repo.findActiveStudentIdOwners(tenant, candidateStudentIds)
        : Promise.resolve(new Map<string, string>()),
    ]);
    const activeContactIds = new Set(activeContactsList.map(String));

    for (const id of ids) {
      const existing = existingMap.get(String(id));
      if (!existing || !existing.deletedAt) {
        failed += 1;
        continue;
      }
      const contactId = existing.contactId ? String(existing.contactId).trim() : null;
      if (contactId && (acceptedContactIds.has(contactId) || activeContactIds.has(contactId))) {
        failed += 1;
        conflicts.push({
          id: String(id),
          errors: [{ field: "contact", message: "A student with this contact already exists" }],
        });
        continue;
      }

      const normalizedGr = existing.grNumber ? existing.grNumber.trim().toLowerCase() : null;
      const activeOwner = normalizedGr ? activeGrOwners.get(normalizedGr) : undefined;
      if (
        (normalizedGr && acceptedGrNumbers.has(normalizedGr)) ||
        Boolean(activeOwner && activeOwner !== String(id))
      ) {
        failed += 1;
        conflicts.push({
          id: String(id),
          errors: [{ field: "grNumber", message: "A student with this GR number already exists" }],
        });
        continue;
      }

      const normalizedSid = existing.studentId ? existing.studentId.trim().toLowerCase() : null;
      const activeSidOwner = normalizedSid ? activeStudentIdOwners.get(normalizedSid) : undefined;
      if (
        (normalizedSid && acceptedStudentIds.has(normalizedSid)) ||
        Boolean(activeSidOwner && activeSidOwner !== String(id))
      ) {
        failed += 1;
        conflicts.push({
          id: String(id),
          errors: [
            { field: "studentId", message: "A student with this Student ID already exists" },
          ],
        });
        continue;
      }

      toSave.push(buildRestoredRecord(existing, userId));
      if (contactId) acceptedContactIds.add(contactId);
      if (normalizedGr) acceptedGrNumbers.add(normalizedGr);
      if (normalizedSid) acceptedStudentIds.add(normalizedSid);
      succeeded += 1;
    }

    if (toSave.length > 0) {
      try {
        if (repo.bulkRestore) {
          await repo.bulkRestore(
            tenant,
            toSave.map((s) => String(s.id)),
            userId,
          );
        } else {
          await repo.bulkSave(tenant, toSave);
        }
      } catch (err: unknown) {
        if (isPgUnique(err)) throw new StudentRestoreConflictError();
        throw err;
      }

      const restoredAt = new Date().toISOString();
      await restoreCascadedEnrollmentsForStudents(
        activeDb(),
        tenant,
        toSave.map((s) => String(s.id)),
        userId,
        new Date(restoredAt),
      );
      for (const s of toSave) {
        await recordRestoreEvents(tenant, s, restoredAt, userId);
      }
    }
    return { succeeded, failed, conflicts };
  });
  if (result.succeeded > 0) {
    const tenant = getRequestTenant();
    if (tenant) await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
  }
  return result;
}

export { recordRestoreEvents } from "./studentAuditEvents.js";
