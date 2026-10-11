import type { QuestionBankModulePreferences } from "@mms/shared";
import {
  getQuestionBankModulePreferencesForWorkspace,
  replaceQuestionBankModulePreferencesForWorkspace,
} from "../db/repositories/questionBankModulePreferencesRepository.js";

export async function getQuestionBankPreferences(
  workspaceSubdomain: string,
): Promise<Partial<QuestionBankModulePreferences>> {
  const prefs = await getQuestionBankModulePreferencesForWorkspace(workspaceSubdomain);
  return prefs ?? {};
}

export async function updateQuestionBankPreferences(
  workspaceSubdomain: string,
  preferences: Partial<QuestionBankModulePreferences> | Record<string, unknown>,
): Promise<void> {
  await replaceQuestionBankModulePreferencesForWorkspace(
    workspaceSubdomain,
    preferences as Partial<QuestionBankModulePreferences>,
  );
}
