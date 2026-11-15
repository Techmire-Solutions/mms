import { describe, expect, it } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { validateLlmConfigInput } from "./llmConfigValidation";

const t = ((key: string) => key) as unknown as TranslationFunction;
const base = {
  name: "Primary",
  provider: "gemini" as const,
  model: "gemini-2.5-flash",
  baseUrl: "",
  apiKey: "secret",
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
  editingExisting: false,
};

describe("validateLlmConfigInput", () => {
  it("accepts a valid new config", () => {
    expect(validateLlmConfigInput(base, t)).toBeNull();
  });

  it("rejects invalid URLs, token budgets, and sampling ranges", () => {
    expect(validateLlmConfigInput({ ...base, baseUrl: "not a url" }, t)).toBe(
      "settings.llmModalInvalidUrl",
    );
    expect(validateLlmConfigInput({ ...base, maxTokens: 0 }, t)).toBe(
      "settings.llmModalInvalidMaxTokens",
    );
    expect(validateLlmConfigInput({ ...base, temperature: 2.1 }, t)).toBe(
      "settings.llmModalInvalidTemperature",
    );
    expect(validateLlmConfigInput({ ...base, topP: 1.1 }, t)).toBe("settings.llmModalInvalidTopP");
  });

  it("requires a key on create but accepts a blank key when editing", () => {
    expect(validateLlmConfigInput({ ...base, apiKey: "" }, t)).toBe("common.fieldRequired");
    expect(validateLlmConfigInput({ ...base, apiKey: "", editingExisting: true }, t)).toBeNull();
  });
});
