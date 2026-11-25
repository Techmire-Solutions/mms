import { hasanatFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: hasanatFieldConfigs,
  jsonColumn: "config",
}); // hasanatFieldConfigs);

export const getHasanatFieldConfig = repo.getByWorkspace;
export const setHasanatFieldConfig = repo.upsert;
export const replaceHasanatFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllHasanatFieldConfigsByWorkspace = repo.listAllByWorkspace;
