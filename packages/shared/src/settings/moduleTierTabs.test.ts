import { describe, expect, it } from "vitest";
import {
  normalizeModuleTierTabId,
  resolveModuleTierTab,
  refreshModuleTierTabKeys,
  refreshModuleTierTabLabels,
} from "./moduleTierTabs.js";
import { DEFAULT_PAGE_TABS } from "../contacts/contactTypes.js";

describe("moduleTierTabs", () => {
  it("normalizes legacy tier tab ids", () => {
    expect(normalizeModuleTierTabId("operations")).toBe("work");
    expect(normalizeModuleTierTabId("analytics")).toBe("reports");
    expect(normalizeModuleTierTabId("configuration")).toBe("setup");
    expect(normalizeModuleTierTabId("work")).toBe("work");
    expect(normalizeModuleTierTabId("")).toBe("");
  });

  it("resolveModuleTierTab keeps collapsed and visible tabs", () => {
    const visible = ["work", "reports"] as const;
    expect(resolveModuleTierTab("", visible)).toBe("");
    expect(resolveModuleTierTab("work", visible)).toBe("work");
    expect(resolveModuleTierTab("setup", visible)).toBe("");
  });

  it("upgrades legacy keys and English labels", () => {
    const tabs = [
      { key: "operations", label: "Operations", enabled: true, order: 0, isSystem: true },
      { key: "analytics", label: "Analytics", enabled: true, order: 1, isSystem: true },
      { key: "configuration", label: "Configuration", enabled: true, order: 2, isSystem: true },
    ];
    const refreshedTabs = refreshModuleTierTabLabels(refreshModuleTierTabKeys(tabs));
    expect(refreshedTabs.map((tab) => tab.key)).toEqual(["work", "reports", "setup"]);
    expect(refreshedTabs.map((tab) => tab.label)).toEqual(["Work", "Reports", "Setup"]);
  });

  it("matches DEFAULT_PAGE_TABS ids and labels", () => {
    expect(DEFAULT_PAGE_TABS.map((tab) => tab.key)).toEqual(["work", "reports", "setup"]);
    expect(DEFAULT_PAGE_TABS.map((tab) => tab.label)).toEqual(["Work", "Reports", "Setup"]);
  });
});
