import { contactModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: contactModulePreferences,
  jsonColumn: "preferences",
});

export const getContactModulePreferencesByWorkspace = repo.getByWorkspace;
export const upsertContactModulePreferences = repo.upsert;
export const listAllContactModulePreferencesByWorkspace = repo.listAllByWorkspace;
export const replaceContactModulePreferencesForWorkspace = repo.replaceForWorkspace;
