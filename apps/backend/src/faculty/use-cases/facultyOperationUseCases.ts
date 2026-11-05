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
import { reconcileFacultyContactsByFacultyIds } from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { withTenant } from "../../db/tenant-context.js";
import { appendCollectionAuditInTx } from "../../lib/collectionAuditInTx.js";

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
  updatedBy?: string,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: ids.length };

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };

  const succeeded = updatedBy
    ? await repo.bulkUpdateStatusSql(tenant, uniqueIds, status, updatedBy)
    : await repo.bulkUpdateStatusSql(tenant, uniqueIds, status);
  if (succeeded > 0) {
    await reconcileFacultyContactsByFacultyIds(tenant, uniqueIds);
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

/**
 * One-shot backfill of missing employee ids for active faculty (Setup writers).
 *
 * Runs as a single tenant transaction serialized by the faculty advisory lock so
 * the batch is all-or-nothing and two concurrent admins cannot mint the same
 * sequence; the batch records one authoritative audit row.
 */
export async function migrateFacultyMissingEmployeeIds(
  repo: FacultyRepository = facultyRepository,
  actorId?: string,
): Promise<{ updated: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { updated: 0 };

  const settings = normalizeFacultyModulePreferences(await loadFacultyModulePreferences());
  const updated = await withTenant(tenant, async (tx) => {
    await repo.lockHierarchy?.(tx, tenant);
    const missing = await repo.listActiveMissingEmployeeId(tenant);
    if (missing.length === 0) return 0;

    // One COUNT for the batch, then advance the sequence locally: the previous
    // per-row helper re-read preferences, re-ran the COUNT and probed collisions
    // for every record (~3-4 queries each).
    const now = new Date();
    const year = now.getFullYear();
    const startSeq =
      Number.isFinite(settings.idStartSeq) && Number(settings.idStartSeq) > 1
        ? Math.floor(Number(settings.idStartSeq))
        : 1;
    const count = await repo.countNextEmployeeId(tenant, {
      prefix: settings.idPrefix,
      restartAnnually: settings.idRestartAnnually,
      year,
    });
    let seq = Math.max(count + 1, startSeq);

    for (const row of missing) {
      let employeeId = formatFacultyEmployeeId(seq, settings, now);
      let attempts = 0;
      while (attempts < 10) {
        const conflict = await repo.findRegistrationConflict(tenant, { employeeId });
        if (conflict !== "employeeId") break;
        seq += 1;
        employeeId = formatFacultyEmployeeId(seq, settings, now);
        attempts += 1;
      }
      if (attempts === 10) {
        throw new Error(
          `Cannot generate a unique employee ID after 10 attempts. Check the prefix ("${settings.idPrefix}") and starting sequence configuration.`,
        );
      }
      await repo.save(tenant, { ...row, employeeId });
      seq += 1;
    }
    await appendCollectionAuditInTx({
      tenant,
      tableName: "faculty",
      recordId: "employee-id-backfill",
      action: "faculty.employee_id_backfill",
      summary: `Backfilled employee IDs for ${missing.length} faculty member(s)`,
      realUserId: actorId ?? null,
    });
    return missing.length;
  });

  if (updated > 0) await broadcastCollection("faculty");
  return { updated };
}
