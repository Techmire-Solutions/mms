import {
  computeNextGrNumber,
  formatTemplateSequence,
  normalizeStudentModulePreferences,
  todayISO,
  STUDENT_STATUS_VALUES,
  type StudentStatus,
  type StudentDuplicateCheckInput,
  type StudentGrNumberSettings,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { loadStudentModulePreferences } from "./studentPreferencesService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import { throwGrUniqueConflict } from "./studentNormalizeUseCases.js";
import {
  buildStudentStatusActor,
  collectStatusTransitions,
  recordStudentStatusAuditEvents,
  withdrawEnrollmentsEndedByStatus,
} from "./studentStatusTransitionUseCases.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";

import {
  bulkEnrollStudentsIntoClass,
  type BulkEnrollInput,
} from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
export async function computeNextGrNumberForDate(
  regDate: string,
  settings: StudentGrNumberSettings,
  repo: StudentsRepository = studentsRepository,
): Promise<string> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return computeNextGrNumber([], settings, regDate);
  }
  if (repo.previewNextGrNumber) {
    return repo.previewNextGrNumber(tenant, { regDate, settings });
  }
  if (repo.generateNextGrNumber) {
    return repo.generateNextGrNumber(tenant, { regDate, settings });
  }
  const restartAnnually = settings.grNumberRestartAnnually !== false;
  const count = await repo.countNextGrNumber(tenant, { regDate, restartAnnually });
  const template = settings.grNumberTemplate || "{seq}-{year}";
  const digits = settings.grNumberDigits || 4;

  let candidateSeq = count + 1;
  const renderGr = (s: number) => formatTemplateSequence(template, s, digits, regDate);
  let candidateGr = renderGr(candidateSeq);

  let attempts = 0;
  while (attempts < 100) {
    const conflict = await repo.findRegistrationConflict(tenant, { grNumber: candidateGr });
    if (conflict !== "grNumber") break;
    candidateSeq += 1;
    candidateGr = renderGr(candidateSeq);
    attempts += 1;
  }

  return candidateGr;
}

export async function computeNextGrNumberBatchForDate(
  regDate: string,
  count: number,
  settings: StudentGrNumberSettings,
  repo: StudentsRepository = studentsRepository,
): Promise<string[]> {
  if (count <= 0) return [];
  const tenant = getRequestTenant();
  if (tenant && repo.generateNextGrNumberBatch) {
    return repo.generateNextGrNumberBatch(tenant, count, { regDate, settings });
  }
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await computeNextGrNumberForDate(regDate, settings, repo));
  }
  return results;
}

export async function checkStudentRegistrationDuplicate(
  input: StudentDuplicateCheckInput,
  repo: StudentsRepository = studentsRepository,
  tenantOverride?: string,
): Promise<{ reason: "contact" | "email" | "nameDob" | "grNumber" | null }> {
  const tenant = tenantOverride || getRequestTenant();
  if (!tenant) return { reason: null };
  const reason = await repo.findRegistrationConflict(tenant, input);
  return { reason };
}

/**
 * Bulk status change with the same domain side effects as a single edit.
 *
 * Runs in one transaction so the status write, the enrollment withdrawals it triggers (seat
 * release, waitlist offer, withdrawal invoice settlement) and the per-student audit rows commit
 * together — a withdrawal failure rolls the status change back instead of leaving the two domains
 * disagreeing.
 */
export async function bulkUpdateStudentStatus(
  ids: string[],
  status: string,
  repo: StudentsRepository = studentsRepository,
  user?: User,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: ids.length };

  const normalizedStatus = status.trim().toLowerCase() as StudentStatus;
  if (!STUDENT_STATUS_VALUES.includes(normalizedStatus)) {
    const error = new Error(
      `Invalid status "${status}". Allowed values: ${STUDENT_STATUS_VALUES.join(", ")}`,
    ) as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };

  const userId = user?.id ? String(user.id) : undefined;
  const actor = buildStudentStatusActor(user);

  const result = await runInTransaction(async () => {
    const affected = await repo.findByIds(tenant, uniqueIds);
    const previousStatusById = new Map(
      affected.map((student) => [String(student.id), student.status as string | undefined]),
    );
    const succeeded = userId
      ? await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus, userId)
      : await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus);

    const transitions = collectStatusTransitions(
      affected.map((student) => ({ id: String(student.id), status: student.status })),
      normalizedStatus,
    );
    await withdrawEnrollmentsEndedByStatus(
      tenant,
      transitions.map((transition) => transition.id),
      normalizedStatus,
      previousStatusById,
      actor,
    );
    await recordStudentStatusAuditEvents(tenant, transitions, userId);
    await reconcileContactSystemTags(
      tenant,
      affected.flatMap((s) => [
        s.contactId,
        s.fatherContactId,
        s.motherContactId,
        s.guardianContactId,
      ]),
      userId ? { actorId: userId } : undefined,
    );
    return { succeeded, failed: uniqueIds.length - succeeded };
  });

  if (result.succeeded > 0) {
    await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
  }
  return result;
}

/** Cap per migrate request so Setup backfill stays bounded (re-invoke while hasMore). */
const MIGRATE_GR_CHUNK = 100;

/** Chunked backfill of missing GR numbers for active students (Setup writers). */
export async function migrateStudentsMissingGrNumbers(
  userIdOrRepo?: string | StudentsRepository,
  repoOrUserId?: StudentsRepository | string,
): Promise<{ updated: number; hasMore: boolean }> {
  const tenant = getRequestTenant();
  if (!tenant) return { updated: 0, hasMore: false };

  const userId =
    typeof userIdOrRepo === "string"
      ? userIdOrRepo
      : typeof repoOrUserId === "string"
        ? repoOrUserId
        : undefined;
  const repo =
    typeof userIdOrRepo === "object" && userIdOrRepo !== null
      ? userIdOrRepo
      : typeof repoOrUserId === "object" && repoOrUserId !== null
        ? repoOrUserId
        : studentsRepository;

  const settings = normalizeStudentModulePreferences(await loadStudentModulePreferences());
  const missing = await repo.listActiveMissingGrNumber(tenant, { limit: MIGRATE_GR_CHUNK });
  if (missing.length === 0) return { updated: 0, hasMore: false };

  const fallbackDate = todayISO();
  const prefs = {
    grNumberTemplate: settings.grNumberTemplate,
    grNumberDigits: settings.grNumberDigits,
    grNumberRestartAnnually: settings.grNumberRestartAnnually,
  };
  const batchGrs = await computeNextGrNumberBatchForDate(fallbackDate, missing.length, prefs, repo);
  let updated = 0;
  for (let i = 0; i < missing.length; i++) {
    const row = missing[i]!;
    const grNumber = batchGrs[i] ?? (await computeNextGrNumberForDate(fallbackDate, prefs, repo));
    try {
      await repo.save(tenant, { ...row, grNumber, updatedBy: userId });
    } catch (error: unknown) {
      throwGrUniqueConflict(error);
    }
    updated += 1;
  }

  await broadcastCollection("students");
  return { updated, hasMore: missing.length >= MIGRATE_GR_CHUNK };
}

/** Students-module entry point; enrollment rows are created/cancelled by the Enrollments domain. */
export async function bulkEnrollStudents(
  input: BulkEnrollInput,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: input.studentIds.length };
  return bulkEnrollStudentsIntoClass(tenant, input);
}
