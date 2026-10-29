import { describe, expect, it } from "vitest";
import {
  canonicalizeRbacModuleId,
  filterRbacModulesForSettings,
  getRbacModuleDef,
  isRbacModuleEnabled,
  isValidRbacModuleId,
  LEGACY_RBAC_MODULE_ALIASES,
  RBAC_MODULE_IDS,
  RBAC_MODULE_REGISTRY,
  RBAC_MODULES_BY_ID,
  rbacModuleSystemId,
} from "./userRbacModuleRegistry.js";

describe("userRbacModuleRegistry", () => {
  it("contains all 20 canonical RBAC modules", () => {
    expect(RBAC_MODULE_IDS.length).toBe(20);
    expect(RBAC_MODULE_REGISTRY.length).toBe(20);
    for (const id of RBAC_MODULE_IDS) {
      expect(RBAC_MODULES_BY_ID[id]).toBeDefined();
      expect(RBAC_MODULES_BY_ID[id].id).toBe(id);
    }
  });

  it("leaves unknown ids unchanged when no legacy aliases remain", () => {
    expect(Object.keys(LEGACY_RBAC_MODULE_ALIASES)).toEqual([]);
    expect(canonicalizeRbacModuleId("teachers")).toBe("teachers");
    expect(canonicalizeRbacModuleId("faculty")).toBe("faculty");
    expect(canonicalizeRbacModuleId("students")).toBe("students");
  });

  it("resolves system module IDs correctly", () => {
    expect(rbacModuleSystemId("faculty")).toBe("faculty");
    expect(rbacModuleSystemId("teachers")).toBe("teachers");
    expect(rbacModuleSystemId("enrollments")).toBe("enrollment");
    expect(rbacModuleSystemId("examinations")).toBe("examination");
    expect(rbacModuleSystemId("obligations")).toBe("obligations");
    expect(rbacModuleSystemId("students")).toBe("students");
    expect(rbacModuleSystemId("finance")).toBe("finance");
    expect(rbacModuleSystemId("tasks.assign_anywhere")).toBe("tasks");
    expect(rbacModuleSystemId("unknown_mod")).toBe("unknown_mod");
  });

  it("getRbacModuleDef returns module definition or undefined", () => {
    expect(getRbacModuleDef("students")?.labelKey).toBe("nav.students");
    expect(getRbacModuleDef("faculty")?.labelKey).toBe("nav.faculty");
    expect(getRbacModuleDef("teachers")).toBeUndefined();
    expect(getRbacModuleDef("tasks.assign_anywhere")?.labelKey).toBe(
      "users.rbac.tasksAssignAnywhere",
    );
    expect(getRbacModuleDef("nonexistent")).toBeUndefined();
  });

  it("isValidRbacModuleId correctly identifies valid RBAC modules", () => {
    expect(isValidRbacModuleId("students")).toBe(true);
    expect(isValidRbacModuleId("dashboard")).toBe(true);
    expect(isValidRbacModuleId("faculty")).toBe(true);
    expect(isValidRbacModuleId("tasks.assign_anywhere")).toBe(true);
    expect(isValidRbacModuleId("teachers")).toBe(false);
    expect(isValidRbacModuleId("accounting")).toBe(true);
    expect(isValidRbacModuleId("fake_module")).toBe(false);
    expect(isValidRbacModuleId(null)).toBe(false);
    expect(isValidRbacModuleId(123)).toBe(false);
  });

  it("always enables settings module regardless of settings toggles", () => {
    expect(isRbacModuleEnabled("settings", { settings: false })).toBe(true);
  });

  it("filters modules according to enabled settings", () => {
    const enabledModules = {
      faculty: false,
      enrollment: false,
    };
    const visible = filterRbacModulesForSettings(enabledModules);
    expect(visible.some((m) => m.id === "faculty")).toBe(false);
    expect(visible.some((m) => m.id === "enrollments")).toBe(false);
    expect(visible.some((m) => m.id === "students")).toBe(true);
    expect(visible.some((m) => m.id === "settings")).toBe(true);
  });

  it("hides tasks.assign_anywhere when the tasks system module is disabled", () => {
    const visible = filterRbacModulesForSettings({ tasks: false });
    expect(visible.some((m) => m.id === "tasks")).toBe(false);
    expect(visible.some((m) => m.id === "tasks.assign_anywhere")).toBe(false);
  });

  it("shows tasks.assign_anywhere when the tasks system module is enabled", () => {
    const visible = filterRbacModulesForSettings({ tasks: true });
    expect(visible.some((m) => m.id === "tasks")).toBe(true);
    expect(visible.some((m) => m.id === "tasks.assign_anywhere")).toBe(true);
  });

  it("defaults to all modules enabled when null/undefined settings provided", () => {
    const visible = filterRbacModulesForSettings(null);
    expect(visible.length).toBe(20);
  });
});
