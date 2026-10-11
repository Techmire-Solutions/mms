import { facultyModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: facultyModulePreferences,
  jsonColumn: "preferences",
});

export const getFacultyModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertFacultyModulePreferences = repo.upsert;
export const listAllFacultyModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceFacultyModulePreferencesForWorkspace = repo.replaceForWorkspace;
