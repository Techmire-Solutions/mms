import { sessionModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: sessionModulePreferences,
  jsonColumn: "preferences",
});

export const getSessionModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertSessionModulePreferences = repo.upsert;
export const listAllSessionModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceSessionModulePreferencesForWorkspace = repo.replaceForWorkspace;
