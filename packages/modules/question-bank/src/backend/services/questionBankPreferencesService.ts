import type { QuestionBankPreferencesBlob } from "@mms/contracts";
import {
  getQuestionBankModulePreferencesForWorkspace,
  replaceQuestionBankModulePreferencesForWorkspace,
} from "../repository/questionBankModulePreferencesRepository.js";

export async function getQuestionBankPreferences(
  workspaceSubdomain: string,
): Promise<QuestionBankPreferencesBlob> {
  const prefs = await getQuestionBankModulePreferencesForWorkspace(workspaceSubdomain);
  return prefs ?? {};
}

export async function updateQuestionBankPreferences(
  workspaceSubdomain: string,
  preferences: QuestionBankPreferencesBlob,
): Promise<void> {
  await replaceQuestionBankModulePreferencesForWorkspace(workspaceSubdomain, preferences);
}
