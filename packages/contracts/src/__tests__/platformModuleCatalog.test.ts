import { describe, expect, it } from "vitest";
import {
  buildPlatformModuleCatalog,
  findPlatformBlockedModule,
  normalizePlatformDefaultModules,
  normalizePlatformDisabledModules,
  resolvePlatformProvisionedModuleIds,
} from "../settings/platformModuleCatalog.js";
import { SYSTEM_MODULES } from "../settings/globalSettingsModuleRegistry.js";

describe("platform module catalog", () => {
  it("keeps required modules enabled by default and ignores unknown ids", () => {
    const defaults = normalizePlatformDefaultModules({ tasks: false, nope: false });
    for (const module of SYSTEM_MODULES) {
      if (module.required) expect(defaults[module.id]).toBe(true);
    }
    expect(defaults.tasks).toBe(false);
    expect(defaults).not.toHaveProperty("nope");
  });

  it("drops required/unknown ids from the disabled list", () => {
    expect(normalizePlatformDisabledModules(["finance", "finance", "dashboard", "nope"])).toEqual([
      "finance",
    ]);
  });

  it("marks availability and defaults in the catalog", () => {
    const catalog = buildPlatformModuleCatalog({
      defaultEnabledModules: { tasks: false },
      disabledModules: ["finance"],
    });
    const finance = catalog.find((entry) => entry.id === "finance");
    const tasks = catalog.find((entry) => entry.id === "tasks");
    expect(finance?.platformEnabled).toBe(false);
    expect(tasks?.defaultEnabled).toBe(false);
  });

  it("rejects a requested platform-disabled module", () => {
    expect(
      findPlatformBlockedModule(["students", "finance"], { disabledModules: ["finance"] }),
    ).toBe("finance");
    expect(findPlatformBlockedModule(["students"], { disabledModules: ["finance"] })).toBeNull();
  });

  it("resolves provisioning defaults excluding disabled/required-only rules", () => {
    const ids = resolvePlatformProvisionedModuleIds({
      defaultEnabledModules: { tasks: false },
      disabledModules: ["finance"],
    });
    expect(ids).not.toContain("finance");
    expect(ids).not.toContain("tasks");
    expect(ids).toContain("students");
  });
});
