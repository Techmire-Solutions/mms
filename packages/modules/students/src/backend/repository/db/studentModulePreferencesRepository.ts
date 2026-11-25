import { studentModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: studentModulePreferences,
  jsonColumn: "preferences",
});

export const getStudentModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertStudentModulePreferences = repo.upsert;
export const listAllStudentModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceStudentModulePreferencesForWorkspace = repo.replaceForWorkspace;
