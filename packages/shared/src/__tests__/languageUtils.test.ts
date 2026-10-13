import { describe, expect, it } from "vitest";
import {
  normalizeAppLanguage,
  getLanguageDirection,
  isRtlLanguage,
  resolveQuestionFormLanguage,
  APP_LANGUAGES,
} from "../core/languageUtils.js";

describe("languageUtils", () => {
  describe("normalizeAppLanguage", () => {
    it("normalizes valid language codes and defaults to English", () => {
      expect(normalizeAppLanguage("en")).toBe("en");
      expect(normalizeAppLanguage("ar")).toBe("ar");
      expect(normalizeAppLanguage("ur")).toBe("ur");
      expect(normalizeAppLanguage("fa")).toBe("fa");
      expect(normalizeAppLanguage("invalid")).toBe("en");
      expect(normalizeAppLanguage(undefined)).toBe("en");
    });
  });

  describe("getLanguageDirection and isRtlLanguage", () => {
    it("identifies RTL languages correctly", () => {
      expect(getLanguageDirection("ar")).toBe("rtl");
      expect(getLanguageDirection("ur")).toBe("rtl");
      expect(getLanguageDirection("fa")).toBe("rtl");
      expect(getLanguageDirection("en")).toBe("ltr");

      expect(isRtlLanguage("ar")).toBe(true);
      expect(isRtlLanguage("en")).toBe(false);
    });
  });

  describe("resolveQuestionFormLanguage", () => {
    it("resolves question form language based on toggle state and selection", () => {
      expect(resolveQuestionFormLanguage("en", "ar", true)).toBe("ar");
      expect(resolveQuestionFormLanguage("en", "ar", false)).toBe("en");
      expect(resolveQuestionFormLanguage("ur", "invalid", true)).toBe("ur");
    });
  });

  describe("APP_LANGUAGES manifest", () => {
    it("defines authoritative language metadata", () => {
      expect(APP_LANGUAGES.length).toBe(4);
      expect(APP_LANGUAGES.map((l) => l.code)).toEqual(["en", "ar", "ur", "fa"]);
    });
  });
});
