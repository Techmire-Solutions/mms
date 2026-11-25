import { facultyFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: facultyFieldConfigs,
  jsonColumn: "config",
});

export const getFacultyFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertFacultyFieldConfig = repo.upsert;
export const listAllFacultyFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceFacultyFieldConfigsForWorkspace = repo.replaceForWorkspace;
