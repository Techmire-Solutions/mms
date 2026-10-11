import {
  computeNextGrNumber,
  formatTemplateSequence,
  normalizeStudentModulePreferences,
  todayISO,
  STUDENT_STATUS_VALUES,
  type StudentStatus,
  type StudentDuplicateCheckInput,
  type StudentGrNumberSettings,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { loadStudentModulePreferences } from "./studentPreferencesService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import { throwGrUniqueConflict } from "./studentNormalizeUseCases.js";

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

export async function bulkUpdateStudentStatus(
  ids: string[],
  status: string,
  repo: StudentsRepository = studentsRepository,
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

  const succeeded = await repo.bulkUpdateStatusSql(tenant, uniqueIds, normalizedStatus);
  if (succeeded > 0) {
    await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
  }
  return { succeeded, failed: uniqueIds.length - succeeded };
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

export async function bulkEnrollStudents(
  input: {
    studentIds: string[];
    sessionIds: string[];
    mode?: "add" | "replace" | "remove";
  },
  repo: StudentsRepository = studentsRepository,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: input.studentIds.length };

  const uniqueStudentIds = [
    ...new Set(input.studentIds.map((id) => String(id).trim()).filter(Boolean)),
  ];
  const uniqueSessionIds = [
    ...new Set(input.sessionIds.map((id) => String(id).trim()).filter(Boolean)),
  ];
  if (uniqueStudentIds.length === 0 || uniqueSessionIds.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const result = await repo.bulkEnroll(
    tenant,
    uniqueStudentIds,
    uniqueSessionIds,
    input.mode ?? "add",
  );
  if (result.succeeded > 0) {
    await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
    await broadcastCollection("students");
    await broadcastCollection("sessions");
  }
  return result;
}
