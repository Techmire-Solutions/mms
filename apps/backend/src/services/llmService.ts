import { loadGlobalSettings } from "./globalSettingsService.js";
import { LLM_PROVIDERS_META, type LlmConfig } from "@mms/shared";
import { fetchWithTimeout, safeOptionalExternalHttpUrl } from "../lib/outboundUrl.js";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface AnthropicMessagesResponse {
  content?: Array<{
    text?: string;
  }>;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Calls the configured LLM API (Gemini, OpenAI, or Anthropic Claude, etc.) using native fetch.
 * Selects based on configId, falls back to the default text model config, or fallback single integration settings.
 */
export async function generateCompletion(
  prompt: string,
  options?: {
    systemInstruction?: string;
    configId?: string;
    customConfig?: LlmConfig;
    messages?: Message[];
  },
): Promise<string> {
  const settings = await loadGlobalSettings();
  const configs = settings.llmConfigs ?? [];

  let config = options?.customConfig;
  if (!config) {
    config = configs.find((llmConfig) => llmConfig.id === options?.configId);
  }
  if (!config && options?.configId) {
    throw new Error(`LLM configuration with ID "${options.configId}" was not found.`);
  }

  if (!config) {
    config = configs.find((llmConfig) => llmConfig.isDefaultText);
  }

  const provider = config ? config.provider : (settings.llmProvider ?? "none");
  const apiKey = config ? config.apiKey : (settings.llmApiKey ?? "");
  const model = config ? config.model : "";
  const baseUrl = safeOptionalExternalHttpUrl(config ? config.baseUrl : undefined, "AI base URL");

  if (provider === "none" || !apiKey.trim()) {
    throw new Error(
      "LLM integration is not configured. Please add an LLM configuration in Settings > AI Assistant.",
    );
  }

  if (provider === "gemini") {
    const selectedModel = model.trim() || LLM_PROVIDERS_META.gemini.defaultModel;
    const url = baseUrl?.trim()
      ? `${baseUrl.trim()}/models/${selectedModel}:generateContent?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const contents =
      options?.messages && options.messages.length > 0
        ? options.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          }))
        : [
            {
              parts: [
                ...(options?.systemInstruction
                  ? [{ text: `System Instruction: ${options.systemInstruction}` }]
                  : []),
                { text: prompt },
              ],
            },
          ];

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2048,
        topP: config?.topP ?? 0.9,
      },
    };

    if (options?.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errMsg = await parseApiError(response, "gemini");
      throw new Error(`Gemini API Error: ${errMsg}`);
    }

    const json = (await response.json()) as GeminiGenerateResponse;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Invalid response structure received from Gemini API");
    }
    return text;
  }

  // Group all OpenAI-compatible API providers to keep codebase DRY
  const isOpenAiCompatible =
    provider === "openai" ||
    provider === "deepseek" ||
    provider === "openrouter" ||
    provider === "groq" ||
    provider === "alibaba";
  if (isOpenAiCompatible && provider in LLM_PROVIDERS_META) {
    const providerMeta = LLM_PROVIDERS_META[provider as keyof typeof LLM_PROVIDERS_META];
    const url = baseUrl?.trim() || providerMeta.defaultUrl;
    const selectedModel = model.trim() || providerMeta.defaultModel;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === "openrouter") {
      const domain = process.env.MMS_APP_DOMAIN?.trim();
      headers["HTTP-Referer"] = domain ? `https://${domain}` : "http://localhost:3000";
      headers["X-Title"] = "MMS";
    }

    const messages =
      options?.messages && options.messages.length > 0
        ? [
            ...(options?.systemInstruction
              ? [{ role: "system", content: options.systemInstruction }]
              : []),
            ...options.messages,
          ]
        : [
            ...(options?.systemInstruction
              ? [{ role: "system", content: options.systemInstruction }]
              : []),
            { role: "user", content: prompt },
          ];

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxTokens ?? 2048,
        top_p: config?.topP ?? 0.9,
      }),
    });

    if (!response.ok) {
      const errMsg = await parseApiError(response, provider);
      throw new Error(`${provider.toUpperCase()} API Error: ${errMsg}`);
    }

    const json = (await response.json()) as OpenAiChatResponse;
    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Invalid response structure received from ${provider.toUpperCase()} API`);
    }
    return text;
  }

  if (provider === "anthropic") {
    const selectedModel = model.trim() || LLM_PROVIDERS_META.anthropic.defaultModel;
    const url = baseUrl?.trim() || "https://api.anthropic.com/v1/messages";

    const messages =
      options?.messages && options.messages.length > 0
        ? options.messages.map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }))
        : [{ role: "user" as const, content: prompt }];

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: config?.maxTokens ?? 4000,
        temperature: config?.temperature ?? 0.7,
        top_p: config?.topP ?? 0.9,
        ...(options?.systemInstruction ? { system: options.systemInstruction } : {}),
        messages,
      }),
    });

    if (!response.ok) {
      const errMsg = await parseApiError(response, "anthropic");
      throw new Error(`Anthropic API Error: ${errMsg}`);
    }

    const json = (await response.json()) as AnthropicMessagesResponse;
    const text = json.content?.[0]?.text;
    if (!text) {
      throw new Error("Invalid response structure received from Anthropic API");
    }
    return text;
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

async function parseApiError(response: Response, provider: string): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    if (provider === "gemini") {
      const geminiError = json.error as { message?: string } | undefined;
      return geminiError?.message || text;
    }
    const genericError = json.error as { message?: string } | undefined;
    return genericError?.message || (json.message as string | undefined) || text;
  } catch {
    return text || `Status code ${response.status}`;
  }
}
