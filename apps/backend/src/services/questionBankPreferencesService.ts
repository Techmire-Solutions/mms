import type { QuestionBankPreferencesBlob } from "@mms/shared";
import {
  getQuestionBankModulePreferencesForWorkspace,
  replaceQuestionBankModulePreferencesForWorkspace,
} from "../db/repositories/questionBankModulePreferencesRepository.js";

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
