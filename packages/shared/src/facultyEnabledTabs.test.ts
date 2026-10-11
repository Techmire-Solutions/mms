import { describe, expect, it } from "vitest";
import { defaultFacultyEnabledTabIds, resolveFacultyEnabledTabIds } from "./facultyEnabledTabs.js";
import type { TabDefinition } from "./contactFieldSchemaTypes.js";

describe("resolveFacultyEnabledTabIds", () => {
  it("falls back to registry defaults when settings are absent or empty", () => {
    expect(resolveFacultyEnabledTabIds()).toEqual(defaultFacultyEnabledTabIds());
    expect(resolveFacultyEnabledTabIds(null)).toEqual(defaultFacultyEnabledTabIds());
    expect(resolveFacultyEnabledTabIds({})).toEqual(defaultFacultyEnabledTabIds());
    expect(resolveFacultyEnabledTabIds({ enabledTabs: [] })).toEqual(defaultFacultyEnabledTabIds());
  });

  it("uses non-empty enabledTabs when formTabs are absent and always includes locked tabs", () => {
    expect(resolveFacultyEnabledTabIds({ enabledTabs: ["employment"] })).toEqual(
      expect.arrayContaining(["basic", "employment", "designation"]),
    );
    expect(resolveFacultyEnabledTabIds({ enabledTabs: ["basic", "employment"] })).toEqual(
      expect.arrayContaining(["basic", "employment", "designation"]),
    );
  });

  it("prefers formTabs.enabled over enabledTabs when formTabs are present", () => {
    const formTabs: TabDefinition[] = [
      { key: "basic", label: "Basic", enabled: true, order: 0 },
      { key: "employment", label: "Employment", enabled: false, order: 1 },
      { key: "custom_house", label: "House", enabled: true, order: 2 },
    ];
    const resolved = resolveFacultyEnabledTabIds({
      formTabs,
      enabledTabs: ["basic", "employment"],
    });
    expect(resolved).toEqual(
      expect.arrayContaining(["basic", "employment", "designation", "custom_house"]),
    );
  });

  it("always includes locked profile tabs even when formTabs omit or disable them", () => {
    const formTabs: TabDefinition[] = [
      { key: "basic", label: "Basic", enabled: false, order: 0 },
      { key: "employment", label: "Employment", enabled: true, order: 1 },
    ];
    expect(resolveFacultyEnabledTabIds({ formTabs })).toEqual(
      expect.arrayContaining(["basic", "employment", "designation"]),
    );
  });

  it("never enables the retired hierarchy form tab", () => {
    const formTabs: TabDefinition[] = [
      { key: "basic", label: "Basic", enabled: true, order: 0 },
      { key: "hierarchy", label: "Hierarchy", enabled: true, order: 3 },
    ];
    const resolved = resolveFacultyEnabledTabIds({
      formTabs,
      enabledTabs: ["basic", "hierarchy"],
    });
    expect(resolved).not.toContain("hierarchy");
    expect(defaultFacultyEnabledTabIds()).not.toContain("hierarchy");
  });
});
