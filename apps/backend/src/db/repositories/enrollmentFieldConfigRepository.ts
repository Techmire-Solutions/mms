import { enrollmentFieldConfigs } from "../schema.js";
import { createWorkspaceSingletonJsonRepo } from "./moduleSetupRepoFactories.js";

const repo = createWorkspaceSingletonJsonRepo({
  table: enrollmentFieldConfigs,
  jsonColumn: "config",
});

export const getEnrollmentFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertEnrollmentFieldConfig = repo.upsert;
export const listAllEnrollmentFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceEnrollmentFieldConfigsForWorkspace = repo.replaceForWorkspace;
