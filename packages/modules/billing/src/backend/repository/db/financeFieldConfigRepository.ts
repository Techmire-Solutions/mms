import { financeFieldConfigs } from "@mms/db/schema";
import { createWorkspaceSingletonJsonRepo } from "@mms/be-core/data";

const repo = createWorkspaceSingletonJsonRepo({
  table: financeFieldConfigs,
  jsonColumn: "config",
});

export const getFinanceFieldConfigByWorkspace = repo.getByWorkspace;
export const upsertFinanceFieldConfig = repo.upsert;
export const listAllFinanceFieldConfigsByWorkspace = repo.listAllByWorkspace;
export const replaceFinanceFieldConfigsForWorkspace = repo.replaceForWorkspace;
