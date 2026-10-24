import { hasanatFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: hasanatFieldConfigs,
  jsonColumn: "config",
}); // hasanatFieldConfigs);

export const getHasanatFieldConfig = repo.getByWorkspace;
export const setHasanatFieldConfig = repo.upsert;
export const replaceHasanatFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllHasanatFieldConfigsByWorkspace = repo.listAllByWorkspace;
