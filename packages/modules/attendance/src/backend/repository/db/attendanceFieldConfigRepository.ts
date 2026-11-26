import { attendanceFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: attendanceFieldConfigs,
  jsonColumn: "config",
});

export const getAttendanceFieldConfig = repo.getByWorkspace;
export const setAttendanceFieldConfig = repo.upsert;
export const replaceAttendanceFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllAttendanceFieldConfigsByWorkspace = repo.listAllByWorkspace;
