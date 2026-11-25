import { describe, expect, it } from "vitest";
import { resolveSettingsSection, settingsTabPath } from "./settingsDeepLink";

describe("resolveSettingsSection", () => {
  it("given a valid ?tab= query, should return that section when read", () => {
    expect(resolveSettingsSection("?tab=branding", null)).toBe("branding");
  });

  it("given a valid navigation state, should fall back to it when the query is absent", () => {
    expect(resolveSettingsSection("", { settingsTab: "modules" })).toBe("modules");
  });

  it("given both a query and state, should prefer the query when they disagree", () => {
    expect(resolveSettingsSection("?tab=theme", { settingsTab: "branding" })).toBe("theme");
  });

  it("given invalid or missing values, should return undefined when read", () => {
    expect(resolveSettingsSection("?tab=sms", null)).toBeUndefined();
    expect(resolveSettingsSection("", { settingsTab: 42 })).toBeUndefined();
    expect(resolveSettingsSection("", null)).toBeUndefined();
  });
});

describe("settingsTabPath", () => {
  it("given a settings section, should build the canonical query deep link when called", () => {
    expect(settingsTabPath("branding")).toBe("/settings?tab=branding");
  });
});
