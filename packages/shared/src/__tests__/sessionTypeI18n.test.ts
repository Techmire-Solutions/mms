import { describe, expect, it } from "vitest";
import { sessionTypeI18nKey } from "../sessions/sessionTypeI18n.js";

describe("sessionTypeI18nKey", () => {
  it("maps the built-in session types to their i18n keys", () => {
    expect(sessionTypeI18nKey("Hifz")).toBe("sessions.types.hifz");
    expect(sessionTypeI18nKey("Qaidah")).toBe("sessions.types.qaidah");
    expect(sessionTypeI18nKey("Tajweed")).toBe("sessions.types.tajweed");
    expect(sessionTypeI18nKey("Islamic Studies")).toBe("sessions.types.islamicStudies");
    expect(sessionTypeI18nKey("Arabic")).toBe("sessions.types.arabic");
    expect(sessionTypeI18nKey("Other")).toBe("sessions.types.other");
  });

  it("returns null for empty or unregistered (custom) session types", () => {
    expect(sessionTypeI18nKey(undefined)).toBeNull();
    expect(sessionTypeI18nKey(null)).toBeNull();
    expect(sessionTypeI18nKey("")).toBeNull();
    expect(sessionTypeI18nKey("Sunnah")).toBeNull();
  });
});
