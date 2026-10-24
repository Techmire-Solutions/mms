import { describe, expect, it } from "vitest";
import { roleHasPermission, type Permission } from "../auth/permissions.js";
import { SYSTEM_MODULES } from "../settings/globalSettingsTypes.js";
import {
  ACCESS_CONTROLLED_MODULE_IDS,
  buildModuleAvailability,
  evaluateModuleAccess,
  getModuleActionPermission,
  resolveAccessModuleId,
  toEffectiveModuleFlags,
} from "../settings/moduleAccessPolicy.js";

const asRole = (role: string) => (permission: Permission) => roleHasPermission(role, permission);

describe("moduleAccessPolicy", () => {
  it("covers exactly the system module registry", () => {
    expect([...ACCESS_CONTROLLED_MODULE_IDS].sort()).toEqual(
      SYSTEM_MODULES.map((m) => m.id).sort(),
    );
  });

  it("resolves manifest and legacy aliases to system ids", () => {
    expect(resolveAccessModuleId("enrollments")).toBe("enrollment");
    expect(resolveAccessModuleId("examinations")).toBe("examination");
    expect(resolveAccessModuleId("teachers")).toBeUndefined();
    expect(resolveAccessModuleId("faculty")).toBe("faculty");
    expect(resolveAccessModuleId("finance")).toBe("finance");
    expect(resolveAccessModuleId("settings")).toBeUndefined();
  });

  it("denies a module the platform has not granted even when the tenant enabled it", () => {
    const availability = buildModuleAvailability({ finance: false }, { finance: true });
    expect(availability.finance).toEqual({ granted: false, enabled: false });
    expect(evaluateModuleAccess({ moduleId: "finance", availability, can: () => true })).toEqual({
      allowed: false,
      code: "MODULE_NOT_GRANTED",
    });
  });

  it("denies a disabled module even when the user has permission", () => {
    const availability = buildModuleAvailability(null, { finance: false });
    expect(evaluateModuleAccess({ moduleId: "finance", availability, can: () => true })).toEqual({
      allowed: false,
      code: "MODULE_DISABLED",
    });
  });

  it("denies a missing action permission on an available module", () => {
    const availability = buildModuleAvailability(null, null);
    expect(
      evaluateModuleAccess({ moduleId: "accounting", availability, can: asRole("teacher") }),
    ).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
    expect(
      evaluateModuleAccess({
        moduleId: "students",
        availability,
        can: asRole("accountant"),
        action: "write",
      }),
    ).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
  });

  it("allows when grant, enablement, and permission are all satisfied", () => {
    const availability = buildModuleAvailability({ finance: true }, { finance: true });
    expect(
      evaluateModuleAccess({
        moduleId: "finance",
        availability,
        can: asRole("accountant"),
        action: "write",
      }),
    ).toEqual({ allowed: true });
  });

  it("fails closed when availability is unknown or the module id is unknown", () => {
    expect(
      evaluateModuleAccess({ moduleId: "finance", availability: null, can: () => true }),
    ).toEqual({ allowed: false, code: "MODULE_ACCESS_UNAVAILABLE" });
    expect(
      evaluateModuleAccess({
        moduleId: "nope",
        availability: buildModuleAvailability(null, null),
        can: () => true,
      }),
    ).toEqual({ allowed: false, code: "MODULE_NOT_GRANTED" });
  });

  it("keeps required modules granted and enabled regardless of stored flags", () => {
    const availability = buildModuleAvailability(
      { users: false, students: false },
      { users: false, students: false },
    );
    expect(availability.users).toEqual({ granted: true, enabled: true });
    expect(availability.students).toEqual({ granted: true, enabled: true });
  });

  it("falls back delete → write → read when a manifest omits an action", () => {
    expect(getModuleActionPermission("messaging", "delete")).toBe("messaging.write");
    expect(getModuleActionPermission("dashboard", "write")).toBe("analytics.view");
    expect(getModuleActionPermission("students", "setupWrite")).toBe("settings.global.write");
  });

  it("collapses availability to effective flags and fails closed without data", () => {
    const flags = toEffectiveModuleFlags(
      buildModuleAvailability({ hasanat: false }, { finance: false }),
    );
    expect(flags.hasanat).toBe(false);
    expect(flags.finance).toBe(false);
    expect(flags.students).toBe(true);
    expect(Object.values(toEffectiveModuleFlags(null)).every((v) => v === false)).toBe(true);
  });
});
