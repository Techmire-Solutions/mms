import { describe, it, expect } from "vitest";
import {
  formatLlmSpeed,
  getLlmProviderDefaultModel,
  getLlmProviderModelsUrl,
  resolveLlmModel,
  LLM_PROVIDER_KEYS,
  LLM_PROVIDERS_META,
} from "../llmSettingsTypes.js";

describe("llmSettingsTypes helper utilities", () => {
  describe("formatLlmSpeed", () => {
    it("returns N/A when latencyMs is zero or negative", () => {
      expect(formatLlmSpeed(100, 0)).toBe("N/A");
      expect(formatLlmSpeed(100, -50)).toBe("N/A");
    });

    it("formats words per second accurately", () => {
      // 100 words in 2000ms = 50.0 W/s
      expect(formatLlmSpeed(100, 2000)).toBe("50.0 W/s");
      // 15 words in 1000ms = 15.0 W/s
      expect(formatLlmSpeed(15, 1000)).toBe("15.0 W/s");
    });
  });

  describe("getLlmProviderDefaultModel", () => {
    it("returns default model string for valid provider", () => {
      expect(getLlmProviderDefaultModel("gemini")).toBe("gemini-2.5-flash");
      expect(getLlmProviderDefaultModel("openai")).toBe("gpt-4o-mini");
      expect(getLlmProviderDefaultModel("anthropic")).toBe("claude-3-5-haiku-20241022");
    });
  });

  describe("getLlmProviderModelsUrl", () => {
    it("returns standard provider modelsUrl when no custom baseUrl is passed", () => {
      expect(getLlmProviderModelsUrl("openai")).toBe("https://api.openai.com/v1/models");
      expect(getLlmProviderModelsUrl("deepseek")).toBe("https://api.deepseek.com/models");
    });

    it("appends /models when custom baseUrl is provided", () => {
      expect(getLlmProviderModelsUrl("openai", "https://custom-proxy.com/v1")).toBe(
        "https://custom-proxy.com/v1/models",
      );
    });
  });

  describe("resolveLlmModel", () => {
    it("returns trimmed custom model if specified", () => {
      expect(resolveLlmModel("  gpt-4o  ", "openai")).toBe("gpt-4o");
    });

    it("falls back to default provider model when model is empty or null", () => {
      expect(resolveLlmModel("", "gemini")).toBe("gemini-2.5-flash");
      expect(resolveLlmModel(null, "anthropic")).toBe("claude-3-5-haiku-20241022");
      expect(resolveLlmModel("   ", "groq")).toBe(LLM_PROVIDERS_META.groq.defaultModel);
    });
  });

  describe("LLM_PROVIDER_KEYS", () => {
    it("contains all provider keys from LLM_PROVIDERS_META", () => {
      const expectedKeys = Object.keys(LLM_PROVIDERS_META);
      expect(LLM_PROVIDER_KEYS).toEqual(expectedKeys);
      expect(LLM_PROVIDER_KEYS).toContain("gemini");
      expect(LLM_PROVIDER_KEYS).toContain("openai");
    });
  });
});
