import {
  buildSequenceFormulaTemplate,
  normalizeFacultyModulePreferences,
  type FacultyModulePreferences,
} from "@mms/shared";
import {
  getFacultyModulePreferencesByWorkspace,
  upsertFacultyModulePreferences,
} from "../../db/repositories/facultyModulePreferencesRepository.js";
import { createModulePreferencesService } from "../../lib/createModulePreferencesService.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { getFacultySetupConfig, updateFacultySetupConfig } from "./facultyEmployeeIdService.js";

const service = createModulePreferencesService<FacultyModulePreferences>({
  broadcastKey: "faculty",
  getByWorkspace: getFacultyModulePreferencesByWorkspace,
  upsert: upsertFacultyModulePreferences,
  normalize: normalizeFacultyModulePreferences,
});

export const loadFacultyModulePreferences = async (): Promise<FacultyModulePreferences> => {
  const loaded = await service.load();
  const prefs = loaded ?? normalizeFacultyModulePreferences(null);
  const tenant = getRequestTenant();
  if (tenant) {
    try {
      const config = await getFacultySetupConfig(tenant);
      const yearFormat = config.yearFormat === "YY" ? "YY" : "YYYY";
      return {
        ...prefs,
        idPrefix: config.prefix,
        employeeIdPrefix: config.prefix,
        employeeIdYearFormat: yearFormat,
        employeeIdSequenceDigits: config.sequenceDigits,
        idDigits: config.sequenceDigits,
        employeeIdDelimiter: config.delimiter,
        employeeIdLastYear: config.lastYear,
        employeeIdCurrentSequence: config.currentSequence,
        idTemplate: buildSequenceFormulaTemplate({
          prefix: config.prefix,
          yearFormat,
          delimiter: config.delimiter,
        }),
      };
    } catch {
      return prefs;
    }
  }
  return prefs;
};

export const saveFacultyModulePreferences = async (
  preferences: FacultyModulePreferences,
): Promise<FacultyModulePreferences> => {
  const result = await service.save(preferences);
  const tenant = getRequestTenant();
  if (tenant) {
    try {
      await updateFacultySetupConfig(tenant, preferences);
    } catch {
      // Best-effort sync to dedicated sequence table
    }
  }
  return result;
};
