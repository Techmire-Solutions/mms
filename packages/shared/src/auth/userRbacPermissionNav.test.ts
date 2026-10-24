import { describe, expect, it } from "vitest";
import {
  flattenRbacPermissionGroups,
  groupRbacModulesForPermissionsNav,
  isRbacPermissionGroup,
} from "./userRbacPermissionNav.js";
import { RBAC_MODULE_REGISTRY } from "./userRbacModuleRegistry.js";

describe("userRbacPermissionNav", () => {
  it("groups tasks and assign-anywhere after messaging", () => {
    const groups = groupRbacModulesForPermissionsNav(RBAC_MODULE_REGISTRY);
    const messagingIdx = groups.findIndex((g) => g.groupId === "module-messaging");
    const tasksIdx = groups.findIndex((g) => g.groupId === "module-tasks");
    const elevateIdx = groups.findIndex((g) => g.groupId === "module-tasks.assign_anywhere");
    expect(messagingIdx).toBeGreaterThanOrEqual(0);
    expect(tasksIdx).toBe(messagingIdx + 1);
    expect(elevateIdx).toBe(tasksIdx + 1);
  });

  it("groups RBAC modules in navigation order", () => {
    const groups = groupRbacModulesForPermissionsNav(RBAC_MODULE_REGISTRY);
    expect(groups.length).toBeGreaterThan(0);

    const firstGroup = groups[0];
    expect(firstGroup?.groupId).toBe("module-dashboard");
    expect(firstGroup?.modules[0]?.id).toBe("dashboard");

    const academicsGroup = groups.find((g) => g.groupId === "group-academics");
    expect(academicsGroup?.groupId).toBe("group-academics");
    expect(academicsGroup?.labelKey).toBe("nav.academics");
    expect(academicsGroup?.modules.some((m) => m.id === "students")).toBe(true);
    expect(academicsGroup?.modules.some((m) => m.id === "examinations")).toBe(true);
  });

  it("correctly identifies group sections vs standalone rows", () => {
    const groups = groupRbacModulesForPermissionsNav(RBAC_MODULE_REGISTRY);
    const academicsGroup = groups.find((g) => g.groupId === "group-academics");
    const dashboardGroup = groups.find((g) => g.groupId === "module-dashboard");

    expect(academicsGroup && isRbacPermissionGroup(academicsGroup)).toBe(true);
    expect(dashboardGroup && isRbacPermissionGroup(dashboardGroup)).toBe(false);
  });

  it("flattens groups back to module definitions preserving items", () => {
    const groups = groupRbacModulesForPermissionsNav(RBAC_MODULE_REGISTRY);
    const flat = flattenRbacPermissionGroups(groups);

    expect(flat.length).toBe(RBAC_MODULE_REGISTRY.length);
    for (const original of RBAC_MODULE_REGISTRY) {
      expect(flat.some((m) => m.id === original.id)).toBe(true);
    }
  });

  it("handles empty module input gracefully", () => {
    const groups = groupRbacModulesForPermissionsNav([]);
    expect(groups).toEqual([]);
    expect(flattenRbacPermissionGroups([])).toEqual([]);
  });

  it("appends unplaced custom modules as standalone entries", () => {
    const customModules = [
      ...RBAC_MODULE_REGISTRY,
      { id: "custom_reports", labelKey: "nav.dashboard" as const },
    ];
    const groups = groupRbacModulesForPermissionsNav(customModules);
    const customGroup = groups.find((g) => g.groupId === "module-custom_reports");
    expect(customGroup?.groupId).toBe("module-custom_reports");
    expect(customGroup?.modules[0]?.id).toBe("custom_reports");
  });

  it("places unknown module ids as standalone rows", () => {
    const modules = [
      { id: "faculty", labelKey: "nav.faculty" as const },
      { id: "contacts", labelKey: "nav.contacts" as const },
    ];
    const groups = groupRbacModulesForPermissionsNav(modules);
    expect(groups.some((g) => g.groupId === "module-faculty")).toBe(true);
    expect(groups.some((g) => g.groupId === "module-contacts")).toBe(true);
  });
});
