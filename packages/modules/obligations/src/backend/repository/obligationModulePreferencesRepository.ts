import { obligationModulePreferences } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: obligationModulePreferences,
  jsonColumn: "preferences",
});

export const getObligationModulePreferences = repo.getByWorkspace;
export const setObligationModulePreferences = repo.upsert;
export const replaceObligationModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllObligationModulePreferencesByWorkspace = repo.listAllByWorkspace;
