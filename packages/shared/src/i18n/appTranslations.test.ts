import { describe, it, expect } from "vitest";
import {
  APP_TRANSLATIONS_EN,
  translateAppParams,
  registerLanguagePack,
} from "./appTranslations.js";
import { APP_TRANSLATIONS_AR } from "./appTranslationsAr.js";
import { APP_TRANSLATIONS_UR } from "./appTranslationsUr.js";
import { APP_TRANSLATIONS_FA } from "./appTranslationsFa.js";
import type { AppTranslationKey } from "./appTranslations.js";

describe("Translation System Enhancements", () => {
  it("translates simple placeholders", () => {
    // Register temporary key in en/test for checking
    registerLanguagePack("en", {
      "test.simple": "Hello {name}, welcome to {place}!",
    } as any);

    const result = translateAppParams("test.simple" as any, "en", { name: "Aalin", place: "MMS" });
    expect(result).toBe("Hello Aalin, welcome to MMS!");
  });

  it("formats ICU select plural forms correctly", () => {
    registerLanguagePack("en", {
      "test.icu": "You have {count} {count, select, one {item} other {items}} pending.",
    } as any);

    // Singular count === 1
    const singularResult = translateAppParams("test.icu" as any, "en", { count: 1 });
    expect(singularResult).toBe("You have 1 item pending.");

    // Plural count === 0
    const pluralZeroResult = translateAppParams("test.icu" as any, "en", { count: 0 });
    expect(pluralZeroResult).toBe("You have 0 items pending.");

    // Plural count === 5
    const pluralResult = translateAppParams("test.icu" as any, "en", { count: 5 });
    expect(pluralResult).toBe("You have 5 items pending.");
  });

  it("cascades Farsi translations to Arabic first, then English", () => {
    registerLanguagePack("en", {
      "test.cascade": "English Value",
      "test.only_in_ar": "Arabic En",
      "test.only_in_fa": "Farsi Only",
    } as any);

    registerLanguagePack("ar", {
      "test.cascade": "Arabic Value",
      "test.only_in_ar": "Arabic Value",
    } as any);

    registerLanguagePack("fa", {
      "test.cascade": "Farsi Value",
      "test.only_in_fa": "Farsi Value",
    } as any);

    // exact match
    expect(translateAppParams("test.cascade" as any, "fa")).toBe("Farsi Value");
    // fallback to Arabic
    expect(translateAppParams("test.only_in_ar" as any, "fa")).toBe("Arabic Value");
  });

  it("formats numbers automatically based on locale but preserves IDs/Codes", () => {
    registerLanguagePack("en", {
      "test.number": "Total count is {count}, ID is {studentId}, code is {someCode}.",
    } as any);

    const result = translateAppParams("test.number" as any, "en", {
      count: 1250,
      studentId: 9876,
      someCode: 1122,
    });
    expect(result).toBe("Total count is 1,250, ID is 9876, code is 1122.");
  });

  it("validates integrity of canonical APP_TRANSLATIONS_EN keys and values", () => {
    const keys = Object.keys(APP_TRANSLATIONS_EN);
    expect(keys.length).toBeGreaterThan(6000);

    // Ensure all role keys exist
    const roleKeys = [
      "users.role.superAdmin",
      "users.role.admin",
      "users.role.principal",
      "users.role.registrar",
      "users.role.teacher",
      "users.role.assistantTeacher",
      "users.role.librarian",
      "users.role.accountant",
      "users.role.auditor",
      "users.role.custom",
    ];

    for (const roleKey of roleKeys) {
      const val = APP_TRANSLATIONS_EN[roleKey as keyof typeof APP_TRANSLATIONS_EN];
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }

    // Verify well-formed placeholder braces
    for (const key of keys) {
      const val = APP_TRANSLATIONS_EN[key as keyof typeof APP_TRANSLATIONS_EN];
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
      const openCount = (val.match(/\{/g) || []).length;
      const closeCount = (val.match(/\}/g) || []).length;
      expect(openCount).toBe(closeCount);
    }
  });

  it("validates integrity of Persian (FA) translation dictionary", () => {
    const faKeys = Object.keys(APP_TRANSLATIONS_FA);
    expect(faKeys.length).toBeGreaterThan(6000);

    for (const key of faKeys) {
      const val = APP_TRANSLATIONS_FA[key as AppTranslationKey];
      if (!val) continue;
      expect(typeof val).toBe("string");
      const openCount = (val.match(/\{/g) || []).length;
      const closeCount = (val.match(/\}/g) || []).length;
      expect(openCount).toBe(closeCount);
    }
  });

  it("validates integrity of Arabic (AR) and Urdu (UR) translation dictionaries", () => {
    const arKeys = Object.keys(APP_TRANSLATIONS_AR);
    expect(arKeys.length).toBeGreaterThan(6000);
    for (const key of arKeys) {
      const val = APP_TRANSLATIONS_AR[key as AppTranslationKey];
      if (!val) continue;
      const openCount = (val.match(/\{/g) || []).length;
      const closeCount = (val.match(/\}/g) || []).length;
      expect(openCount).toBe(closeCount);
    }

    const urKeys = Object.keys(APP_TRANSLATIONS_UR);

    // Mixed-script ratchet (2026-10-31 review, UX-12): Urdu had `کropper` and
    // `sync` glued into otherwise-Urdu labels. Latin words are allowed (SMTP,
    // WhatsApp) — only a Latin letter directly attached to an Urdu letter is a
    // defect, because it breaks shaping and direction resolution.
    const glued: string[] = [];
    for (const key of urKeys) {
      const val = APP_TRANSLATIONS_UR[key as AppTranslationKey];
      if (!val) continue;
      if (/[\u0621-\u064A][A-Za-z]|[A-Za-z][\u0621-\u064A]/.test(val)) glued.push(key);
    }
    expect(glued, `Urdu values with glued Latin script: ${glued.join(", ")}`).toEqual([]);

    expect(urKeys.length).toBeGreaterThan(6000);
    for (const key of urKeys) {
      const val = APP_TRANSLATIONS_UR[key as AppTranslationKey];
      if (!val) continue;
      const openCount = (val.match(/\{/g) || []).length;
      const closeCount = (val.match(/\}/g) || []).length;
      expect(openCount).toBe(closeCount);
    }
  });

  it("Persian covers every English key so it can load without the Arabic chunk", () => {
    // 2026-10-31 review (UX-13): `fetchLanguagePack("fa")` merged the Arabic
    // pack for a fallback that cannot fire today. This pins the assumption.
    const missing = Object.keys(APP_TRANSLATIONS_EN).filter(
      (key) => APP_TRANSLATIONS_FA[key as AppTranslationKey] === undefined,
    );
    expect(missing, `Persian keys missing: ${missing.slice(0, 10).join(", ")}`).toEqual([]);
  });
});
