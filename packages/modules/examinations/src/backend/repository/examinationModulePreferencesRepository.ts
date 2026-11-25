import { examinationsModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: examinationsModulePreferences,
  jsonColumn: "preferences",
});

export const getExaminationModulePreferences = repo.getByWorkspace;
export const setExaminationModulePreferences = repo.upsert;
export const replaceExaminationModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllExaminationModulePreferencesByWorkspace = repo.listAllByWorkspace;
