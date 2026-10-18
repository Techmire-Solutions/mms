import { attendanceFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: attendanceFieldConfigs,
  jsonColumn: "config",
});

export const getAttendanceFieldConfig = repo.getByWorkspace;
export const setAttendanceFieldConfig = repo.upsert;
export const replaceAttendanceFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllAttendanceFieldConfigsByWorkspace = repo.listAllByWorkspace;
