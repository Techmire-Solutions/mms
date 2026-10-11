import { studentFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: studentFieldConfigs,
  jsonColumn: "config",
});

export const getStudentFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertStudentFieldConfig = repo.upsert;
/** Admin backup snapshot — zero or one row as array. */
export const listAllStudentFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceStudentFieldConfigsForWorkspace = repo.replaceForWorkspace;
