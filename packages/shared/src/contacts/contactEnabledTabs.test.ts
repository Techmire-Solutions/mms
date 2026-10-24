import { describe, expect, it } from "vitest";
import {
  isContactCustomCollectionTab,
  isContactLockedEnabledTab,
  isContactLockedField,
  isContactSeedFormTab,
  resolveContactEnabledTabIds,
  withContactLockedEnabledTabs,
} from "./contactEnabledTabs.js";
import { DEFAULT_ENABLED_TABS } from "./contactPreferenceDefaults.js";

describe("contactEnabledTabs", () => {
  it("recognizes locked tabs case-insensitively", () => {
    expect(isContactLockedEnabledTab("basic")).toBe(true);
    expect(isContactLockedEnabledTab("Basic")).toBe(true);
    expect(isContactLockedEnabledTab("custom")).toBe(false);
    expect(isContactLockedEnabledTab("phones")).toBe(false);
  });

  it("recognizes locked fields", () => {
    expect(isContactLockedField("basic", "firstName")).toBe(true);
    expect(isContactLockedField("basic", "lastName")).toBe(false);
    expect(isContactLockedField("phones", "firstName")).toBe(false);
  });

  it("recognizes seeded form tabs including retired custom", () => {
    expect(isContactSeedFormTab("basic")).toBe(true);
    expect(isContactSeedFormTab("Phones")).toBe(true);
    expect(isContactSeedFormTab("custom")).toBe(true);
    expect(isContactSeedFormTab("custom_abc123")).toBe(false);
  });

  it("treats tenant custom tabs as collection tabs", () => {
    expect(isContactCustomCollectionTab("custom_abc123")).toBe(true);
    expect(isContactCustomCollectionTab("custom")).toBe(false);
    expect(isContactCustomCollectionTab("phones")).toBe(false);
  });

  it("always injects basic into enabled lists", () => {
    expect(withContactLockedEnabledTabs(["phones"]).sort()).toEqual(["basic", "phones"].sort());
  });

  it("respects formTabs.enabled without unioning all DEFAULT_ENABLED_TABS", () => {
    const enabled = resolveContactEnabledTabIds(
      {
        formTabs: [
          { key: "basic", label: "Basic", enabled: true, order: 0 },
          { key: "phones", label: "Phones", enabled: false, order: 1 },
          { key: "emails", label: "Emails", enabled: true, order: 2 },
          { key: "custom", label: "Custom", enabled: false, order: 3 },
        ],
        enabledTabs: [],
      },
      "admin",
    );

    expect(enabled.has("emails")).toBe(true);
    expect(enabled.has("phones")).toBe(false);
    expect(enabled.has("basic")).toBe(true);
    expect(enabled.has("custom")).toBe(false);
    for (const tab of DEFAULT_ENABLED_TABS) {
      if (tab === "emails") continue;
      expect(enabled.has(tab)).toBe(false);
    }
  });

  it("falls back to DEFAULT_ENABLED_TABS when formTabs are absent", () => {
    const enabled = resolveContactEnabledTabIds({ enabledTabs: [] }, "admin");
    for (const tab of DEFAULT_ENABLED_TABS) {
      expect(enabled.has(tab)).toBe(true);
    }
    expect(enabled.has("basic")).toBe(true);
    expect(enabled.has("custom")).toBe(false);
  });
});
