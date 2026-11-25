import { hasanatModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: hasanatModulePreferences,
  jsonColumn: "preferences",
}); // hasanatModulePreferences);

export const getHasanatModulePreferences = repo.getByWorkspace;
export const setHasanatModulePreferences = repo.upsert;
export const replaceHasanatModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllHasanatModulePreferencesByWorkspace = repo.listAllByWorkspace;
