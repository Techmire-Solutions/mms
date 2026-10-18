import { examinationsFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: examinationsFieldConfigs,
  jsonColumn: "config",
});

export const getExaminationFieldConfig = repo.getByWorkspace;
export const setExaminationFieldConfig = repo.upsert;
export const replaceExaminationFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllExaminationFieldConfigsByWorkspace = repo.listAllByWorkspace;
