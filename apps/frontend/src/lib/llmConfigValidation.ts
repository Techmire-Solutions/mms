import { resolveLlmModel, type LlmProviderType } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface LlmConfigValidationInput {
  name: string;
  provider: LlmProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  editingExisting: boolean;
}

/** Client-side guard for the LLM provider modal; returns the first translated error or null. */
export function validateLlmConfigInput(
  input: LlmConfigValidationInput,
  t: TranslationFunction,
): string | null {
  if (!input.name.trim()) return t("common.fieldRequired", { field: t("settings.llmModalName") });
  if (input.name.trim().length > 100) return t("common.maxLength", { max: 100 });
  if (!resolveLlmModel(input.model, input.provider).trim()) {
    return t("common.fieldRequired", { field: t("settings.llmModalModelSelect") });
  }
  if (input.baseUrl.trim()) {
    try {
      new URL(input.baseUrl.trim());
    } catch {
      return t("settings.llmModalInvalidUrl");
    }
  }
  if (!Number.isInteger(input.maxTokens) || input.maxTokens < 1 || input.maxTokens > 16384) {
    return t("settings.llmModalInvalidMaxTokens");
  }
  if (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2) {
    return t("settings.llmModalInvalidTemperature");
  }
  if (!Number.isFinite(input.topP) || input.topP < 0 || input.topP > 1) {
    return t("settings.llmModalInvalidTopP");
  }
  if (!input.editingExisting && !input.apiKey.trim()) {
    return t("common.fieldRequired", { field: t("settings.llmModalApiKey") });
  }
  return null;
}
