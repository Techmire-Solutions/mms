import { financeFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: financeFieldConfigs,
  jsonColumn: "config",
});

export const getFinanceFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertFinanceFieldConfig = repo.upsert;
export const listAllFinanceFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceFinanceFieldConfigsForWorkspace = repo.replaceForWorkspace;
