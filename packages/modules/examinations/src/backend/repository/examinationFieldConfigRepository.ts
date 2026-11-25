import { examinationsFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: examinationsFieldConfigs,
  jsonColumn: "config",
});

export const getExaminationFieldConfig = repo.getByWorkspace;
export const setExaminationFieldConfig = repo.upsert;
export const replaceExaminationFieldConfigsForWorkspace = repo.replaceForWorkspace;
export const listAllExaminationFieldConfigsByWorkspace = repo.listAllByWorkspace;
