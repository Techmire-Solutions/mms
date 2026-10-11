import { studentModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: studentModulePreferences,
  jsonColumn: "preferences",
});

export const getStudentModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertStudentModulePreferences = repo.upsert;
export const listAllStudentModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceStudentModulePreferencesForWorkspace = repo.replaceForWorkspace;
