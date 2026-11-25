import { enrollmentFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: enrollmentFieldConfigs,
  jsonColumn: "config",
});

export const getEnrollmentFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertEnrollmentFieldConfig = repo.upsert;
export const listAllEnrollmentFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceEnrollmentFieldConfigsForWorkspace = repo.replaceForWorkspace;
