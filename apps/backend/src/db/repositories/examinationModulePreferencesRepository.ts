import { examinationsModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: examinationsModulePreferences,
  jsonColumn: "preferences",
});

export const getExaminationModulePreferences = repo.getByWorkspace;
export const setExaminationModulePreferences = repo.upsert;
export const replaceExaminationModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllExaminationModulePreferencesByWorkspace = repo.listAllByWorkspace;
