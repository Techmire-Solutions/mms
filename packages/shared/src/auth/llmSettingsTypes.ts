/** Registry metadata and default settings for supported AI completion providers. */
export const LLM_PROVIDERS_META = {
  gemini: {
    value: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    defaultUrl: "",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  openai: {
    value: "openai",
    label: "OpenAI GPT",
    defaultModel: "gpt-4o-mini",
    defaultUrl: "https://api.openai.com/v1/chat/completions",
    modelsUrl: "https://api.openai.com/v1/models",
  },
  anthropic: {
    value: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-haiku-20241022",
    defaultUrl: "https://api.anthropic.com/v1/messages",
    modelsUrl: "https://api.anthropic.com/v1/models",
  },
  deepseek: {
    value: "deepseek",
    label: "DeepSeek Chat (Ultra-Low Cost)",
    defaultModel: "deepseek-chat",
    defaultUrl: "https://api.deepseek.com/chat/completions",
    modelsUrl: "https://api.deepseek.com/models",
  },
  openrouter: {
    value: "openrouter",
    label: "OpenRouter (Flexible / Free Models)",
    defaultModel: "google/gemini-2.5-flash",
    defaultUrl: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
  },
  groq: {
    value: "groq",
    label: "Groq (Ultra-Fast / High Efficiency)",
    defaultModel: "llama3-8b-8192",
    defaultUrl: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
  },
  alibaba: {
    value: "alibaba",
    label: "Alibaba Cloud Qwen (High Performance)",
    defaultModel: "qwen-plus",
    defaultUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    modelsUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
  },
} as const;

export type LlmProviderType = keyof typeof LLM_PROVIDERS_META;

/** Authoritative key array of all supported AI providers. */
export const LLM_PROVIDER_KEYS = Object.keys(LLM_PROVIDERS_META) as [
  LlmProviderType,
  ...LlmProviderType[],
];

/** Configuration interface for tenant AI provider connections. */
export interface LlmConfig {
  id: string;
  name: string;
  provider: LlmProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
  isDefaultText: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/** Performance and volume metrics returned by AI completion connectivity tests. */
export interface LlmTestMetrics {
  latencyMs: number;
  characterCount: number;
  wordCount: number;
}

/** Result object returned by backend AI test connectivity endpoint `/api/ai/test`. */
export interface LlmTestResult {
  configId?: string;
  success: boolean;
  response?: string;
  message?: string;
  metrics?: LlmTestMetrics;
}

/**
 * Calculates and formats AI response speed in words per second.
 * @param wordCount Number of generated words.
 * @param latencyMs Response latency in milliseconds.
 * @returns Formatted speed string (e.g., '14.2 W/s' or 'N/A').
 */
export function formatLlmSpeed(wordCount: number, latencyMs: number): string {
  if (latencyMs <= 0) return "N/A";
  return `${(wordCount / (latencyMs / 1000)).toFixed(1)} W/s`;
}

/**
 * Resolves the default model string for a given LLM provider.
 * @param provider The LLM provider key.
 * @returns Default model identifier string.
 */
export function getLlmProviderDefaultModel(provider: LlmProviderType): string {
  return LLM_PROVIDERS_META[provider]?.defaultModel ?? "";
}

/**
 * Resolves the models listing endpoint URL for an LLM provider.
 * @param provider Target LLM provider key.
 * @param baseUrl Optional custom base URL override.
 * @returns Fully formatted models listing URL.
 */
export function getLlmProviderModelsUrl(provider: LlmProviderType, baseUrl?: string): string {
  const customBase = baseUrl?.trim();
  if (customBase) {
    return `${customBase}/models`;
  }
  return LLM_PROVIDERS_META[provider]?.modelsUrl ?? "";
}

/**
 * Resolves an active model string for a provider, falling back to provider default if empty.
 * @param model Provided model string or empty input.
 * @param provider Target LLM provider.
 * @returns Non-empty model identifier.
 */
export function resolveLlmModel(
  model: string | undefined | null,
  provider: LlmProviderType,
): string {
  const trimmed = model?.trim();
  return trimmed || getLlmProviderDefaultModel(provider);
}
