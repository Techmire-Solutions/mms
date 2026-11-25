import { getLlmProviderDefaultModel, type LlmProviderType } from "@mms/contracts";

export type PlatformLlmHealthStatus = "verified" | "failed" | "testing" | "untested";

export interface PlatformLlmModalForm {
  name: string;
  provider: LlmProviderType;
  model: string;
  baseUrl: string;
  apiKey: string;
  isDefaultText: boolean;
  temperature: number;
  maxTokens: number;
  topP: number;
}

export const EMPTY_PLATFORM_LLM_FORM: PlatformLlmModalForm = {
  name: "",
  provider: "gemini",
  model: getLlmProviderDefaultModel("gemini"),
  baseUrl: "",
  apiKey: "",
  isDefaultText: true,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
};
