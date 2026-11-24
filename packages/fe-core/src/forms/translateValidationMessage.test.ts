import { describe, expect, it, vi } from "vitest";
import type { TranslationFunction } from "../i18n/types";
import { translateValidationMessage } from "./translateValidationMessage";

const t = vi.fn((key: string) => `t:${key}`) as unknown as TranslationFunction;

describe("translateValidationMessage", () => {
  it("resolves existing translation keys", () => {
    expect(translateValidationMessage("tasks.validation.titleRequired", t)).toBe(
      "t:tasks.validation.titleRequired",
    );
  });

  it("normalizes required-suffix literals to the required key", () => {
    expect(translateValidationMessage("Title is required", t)).toBe("t:validation.required");
    expect(translateValidationMessage("At least one contact ID is required", t)).toBe(
      "t:validation.required",
    );
  });

  it("maps distinct contract literals to dedicated keys", () => {
    expect(translateValidationMessage("Give a reason", t)).toBe("t:validation.reasonTooShort");
    expect(translateValidationMessage("Use a 24-hour HH:mm time", t)).toBe(
      "t:validation.timeFormat",
    );
    expect(translateValidationMessage("Percentage must be 0-100", t)).toBe(
      "t:validation.percentageRange",
    );
  });

  it("never returns the raw English fallback", () => {
    expect(translateValidationMessage("Some unexpected backend message", t)).toBe(
      "t:validation.invalid",
    );
    expect(translateValidationMessage("", t)).toBe("t:validation.invalid");
  });
});
