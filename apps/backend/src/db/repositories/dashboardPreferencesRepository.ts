import { dashboardPreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: dashboardPreferences,
  jsonColumn: "preferences",
});

export const getDashboardPreferencesByWorkspace = repo.getByWorkspace;
export const upsertDashboardPreferences = repo.upsert;
export const listAllDashboardPreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceDashboardPreferencesForWorkspace = repo.replaceForWorkspace;
