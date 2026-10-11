import {
  formatFacultyEmployeeId,
  DEFAULT_FACULTY_SETTINGS,
  normalizeFacultyModulePreferences,
  type FacultyDuplicateCheckInput,
  type FacultyEmployeeIdSettings,
  type FacultyDuplicateReason,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { loadFacultyModulePreferences } from "./facultyPreferencesService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";

/** Active duplicate probe (contact / employeeId) before save — server authoritative. */
export async function checkFacultyRegistrationDuplicate(
  input: FacultyDuplicateCheckInput,
  repo: FacultyRepository = facultyRepository,
): Promise<{ reason: FacultyDuplicateReason | null }> {
  const tenant = getRequestTenant();
  if (!tenant) return { reason: null };
  const reason = await repo.findRegistrationConflict(tenant, input);
  return { reason };
}

export async function bulkUpdateFacultyStatus(
  ids: string[],
  status: string,
  repo: FacultyRepository = facultyRepository,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: ids.length };

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };

  const succeeded = await repo.bulkUpdateStatusSql(tenant, uniqueIds, status);
  if (succeeded > 0) {
    await broadcastCollection("faculty");
  }
  return { succeeded, failed: uniqueIds.length - succeeded };
}

export async function bulkUpdateFacultySpecialization(
  ids: string[],
  specialization: string,
  repo: FacultyRepository = facultyRepository,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: ids.length };

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };

  const succeeded = await repo.bulkUpdateSpecializationSql(tenant, uniqueIds, specialization);
  if (succeeded > 0) {
    await broadcastCollection("faculty");
  }
  return { succeeded, failed: uniqueIds.length - succeeded };
}

/** Next employee id from sequence watermark + dynamic tenant settings + collision probing. */
export async function computeNextFacultyEmployeeIdForSettings(
  settingsInput?: Partial<FacultyEmployeeIdSettings>,
  repo: FacultyRepository = facultyRepository,
): Promise<string> {
  const tenant = getRequestTenant();
  const savedPrefs = tenant
    ? normalizeFacultyModulePreferences(await loadFacultyModulePreferences())
    : DEFAULT_FACULTY_SETTINGS;

  const settings: FacultyEmployeeIdSettings = {
    ...savedPrefs,
    idPrefix:
      settingsInput?.idPrefix?.trim() || savedPrefs.idPrefix || DEFAULT_FACULTY_SETTINGS.idPrefix,
    employeeIdPrefix:
      settingsInput?.employeeIdPrefix?.trim() ||
      settingsInput?.idPrefix?.trim() ||
      savedPrefs.employeeIdPrefix ||
      savedPrefs.idPrefix,
    idTemplate:
      settingsInput?.idTemplate?.trim() ||
      savedPrefs.idTemplate ||
      DEFAULT_FACULTY_SETTINGS.idTemplate,
    idDigits: settingsInput?.idDigits ?? savedPrefs.idDigits ?? DEFAULT_FACULTY_SETTINGS.idDigits,
    employeeIdSequenceDigits:
      settingsInput?.employeeIdSequenceDigits ??
      settingsInput?.idDigits ??
      savedPrefs.employeeIdSequenceDigits ??
      savedPrefs.idDigits,
    employeeIdYearFormat: settingsInput?.employeeIdYearFormat ?? savedPrefs.employeeIdYearFormat,
    employeeIdDelimiter: settingsInput?.employeeIdDelimiter ?? savedPrefs.employeeIdDelimiter,
    idStartSeq:
      settingsInput?.idStartSeq ?? savedPrefs.idStartSeq ?? DEFAULT_FACULTY_SETTINGS.idStartSeq,
    idRestartAnnually:
      settingsInput?.idRestartAnnually ??
      savedPrefs.idRestartAnnually ??
      DEFAULT_FACULTY_SETTINGS.idRestartAnnually,
  };

  const now = new Date();
  const year = now.getFullYear();
  const count = tenant
    ? await repo.countNextEmployeeId(tenant, {
        prefix: settings.idPrefix,
        restartAnnually: settings.idRestartAnnually,
        year,
      })
    : 0;

  const startSeq =
    Number.isFinite(settings.idStartSeq) && Number(settings.idStartSeq) > 1
      ? Math.floor(Number(settings.idStartSeq))
      : 1;

  let candidateSeq = Math.max(count + 1, startSeq);
  let candidateId = formatFacultyEmployeeId(candidateSeq, settings, now);

  if (tenant) {
    let attempts = 0;
    while (attempts < 10) {
      const conflict = await repo.findRegistrationConflict(tenant, { employeeId: candidateId });
      if (conflict !== "employeeId") break;
      candidateSeq += 1;
      candidateId = formatFacultyEmployeeId(candidateSeq, settings, now);
      attempts += 1;
    }
    if (attempts === 10) {
      throw new Error(
        `Cannot generate a unique employee ID after 10 attempts. ` +
          `Check the prefix ("${settings.idPrefix}") and starting sequence configuration.`,
      );
    }
  }

  return candidateId;
}

/** One-shot backfill of missing employee ids for active faculty (Setup writers). */
export async function migrateFacultyMissingEmployeeIds(
  repo: FacultyRepository = facultyRepository,
): Promise<{ updated: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { updated: 0 };

  const settings = normalizeFacultyModulePreferences(await loadFacultyModulePreferences());
  const missing = await repo.listActiveMissingEmployeeId(tenant);
  if (missing.length === 0) return { updated: 0 };

  let updated = 0;
  for (const row of missing) {
    const employeeId = await computeNextFacultyEmployeeIdForSettings(
      { idPrefix: settings.idPrefix },
      repo,
    );
    await repo.save(tenant, { ...row, employeeId });
    updated += 1;
  }

  await broadcastCollection("faculty");
  return { updated };
}
