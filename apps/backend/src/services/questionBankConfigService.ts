import type { QuestionBankSettings } from "@mms/shared";
import {
  getQuestionBankFieldConfigsForWorkspace,
  replaceQuestionBankFieldConfigsForWorkspace,
} from "../db/repositories/questionBankFieldConfigRepository.js";

export async function getQuestionBankFieldConfig(
  workspaceSubdomain: string,
): Promise<Partial<QuestionBankSettings>> {
  const config = await getQuestionBankFieldConfigsForWorkspace(workspaceSubdomain);
  return config ?? {};
}

export async function updateQuestionBankFieldConfig(
  workspaceSubdomain: string,
  config: Partial<QuestionBankSettings> | Record<string, unknown>,
): Promise<void> {
  await replaceQuestionBankFieldConfigsForWorkspace(
    workspaceSubdomain,
    config as Partial<QuestionBankSettings>,
  );
}
