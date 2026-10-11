import { attendanceModulePreferences } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: attendanceModulePreferences,
  jsonColumn: "preferences",
});

export const getAttendanceModulePreferences = repo.getByWorkspace;
export const setAttendanceModulePreferences = repo.upsert;
export const replaceAttendanceModulePreferencesForWorkspace = repo.replaceForWorkspace;
export const listAllAttendanceModulePreferencesByWorkspace = repo.listAllByWorkspace;
