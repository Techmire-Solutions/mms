import { obligationModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: obligationModulePreferences,
  jsonColumn: "preferences",
});

export const getObligationModulePreferences = repo.getByWorkspace;
export const setObligationModulePreferences = repo.upsert;
export const replaceObligationModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllObligationModulePreferencesByWorkspace = repo.listAllByWorkspace;
