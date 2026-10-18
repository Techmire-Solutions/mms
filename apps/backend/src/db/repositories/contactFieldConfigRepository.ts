import { contactFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: contactFieldConfigs,
  jsonColumn: "config",
});

export const getContactFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertContactFieldConfig = repo.upsert;
/** Admin backup snapshot — zero or one row as array. */
export const listAllContactFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceContactFieldConfigsForWorkspace = repo.replaceForWorkspace;
