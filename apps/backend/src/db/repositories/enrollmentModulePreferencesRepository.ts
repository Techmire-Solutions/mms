import { enrollmentModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: enrollmentModulePreferences,
  jsonColumn: "preferences",
});

export const getEnrollmentModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertEnrollmentModulePreferences = repo.upsert;
export const listAllEnrollmentModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceEnrollmentModulePreferencesForWorkspace = repo.replaceForWorkspace;
