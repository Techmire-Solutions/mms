import { sessionFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: sessionFieldConfigs,
  jsonColumn: "config",
});

export const getSessionFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertSessionFieldConfig = repo.upsert;
export const listAllSessionFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceSessionFieldConfigsForWorkspace = repo.replaceForWorkspace;
