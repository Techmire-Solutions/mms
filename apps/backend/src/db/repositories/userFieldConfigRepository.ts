import { userFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: userFieldConfigs,
  jsonColumn: "config",
});

export const getUserFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertUserFieldConfig = repo.upsert;
export const listAllUserFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceUserFieldConfigsForWorkspace = repo.replaceForWorkspace;
