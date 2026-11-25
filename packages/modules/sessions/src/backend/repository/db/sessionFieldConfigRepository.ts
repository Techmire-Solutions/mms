import { sessionFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: sessionFieldConfigs,
  jsonColumn: "config",
});

export const getSessionFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertSessionFieldConfig = repo.upsert;
export const listAllSessionFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceSessionFieldConfigsForWorkspace = repo.replaceForWorkspace;
