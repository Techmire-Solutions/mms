import { enrollmentModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: enrollmentModulePreferences,
  jsonColumn: "preferences",
});

export const getEnrollmentModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertEnrollmentModulePreferences = repo.upsert;
export const listAllEnrollmentModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceEnrollmentModulePreferencesForWorkspace = repo.replaceForWorkspace;
