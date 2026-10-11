import { accountingFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: accountingFieldConfigs,
  jsonColumn: "config",
});

export const getAccountingFieldConfig = repo.getByWorkspace;
export const setAccountingFieldConfig = repo.upsert;
export const replaceAccountingFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllAccountingFieldConfigsByWorkspace = repo.listAllByWorkspace;
