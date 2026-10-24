import { describe, expect, it } from "vitest";
import {
  STUDENT_TAB_REGISTRY,
  isStudentLockedEnabledTab,
  isStudentSeedFormTab,
} from "../settings/moduleFieldSetupPersons.js";

describe("student seed / locked tab helpers", () => {
  it("treats registry keys as seed tabs", () => {
    expect(isStudentSeedFormTab("basic")).toBe(true);
    expect(isStudentSeedFormTab("Registration")).toBe(true);
    expect(isStudentSeedFormTab("custom_foo")).toBe(false);
    expect(STUDENT_TAB_REGISTRY.every((tab) => isStudentSeedFormTab(tab.key))).toBe(true);
  });

  it("locks only basic as always-enabled", () => {
    expect(isStudentLockedEnabledTab("basic")).toBe(true);
    expect(isStudentLockedEnabledTab("Basic")).toBe(true);
    expect(isStudentLockedEnabledTab("registration")).toBe(false);
  });
});
