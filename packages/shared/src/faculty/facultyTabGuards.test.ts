import { describe, expect, it } from "vitest";
import {
  FACULTY_TAB_REGISTRY,
  isFacultyLockedEnabledTab,
  isFacultySeedFormTab,
} from "../settings/moduleFieldSetupFaculty.js";

describe("faculty seed / locked tab helpers", () => {
  it("treats registry keys as seed tabs", () => {
    expect(isFacultySeedFormTab("basic")).toBe(true);
    expect(isFacultySeedFormTab("Employment")).toBe(true);
    expect(isFacultySeedFormTab("custom_foo")).toBe(false);
    expect(FACULTY_TAB_REGISTRY.every((tab) => isFacultySeedFormTab(tab.key))).toBe(true);
  });

  it("locks basic, employment, and designation as always-enabled", () => {
    expect(isFacultyLockedEnabledTab("basic")).toBe(true);
    expect(isFacultyLockedEnabledTab("Basic")).toBe(true);
    expect(isFacultyLockedEnabledTab("employment")).toBe(true);
    expect(isFacultyLockedEnabledTab("designation")).toBe(true);
  });
});
