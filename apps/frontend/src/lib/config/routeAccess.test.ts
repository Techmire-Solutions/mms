import { describe, expect, it } from "vitest";
import {
  ACCESS_CONTROLLED_MODULE_IDS,
  buildModuleAvailability,
  evaluateModuleAccess,
  roleHasPermission,
} from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import { NAV_ITEMS } from "@/lib/config/navConfig";
import {
  TENANT_APP_ROUTE_ACCESS,
  canShowRoute,
  findRouteAccessRule,
  resolveRouteAccess,
  type ModuleAccessEvaluator,
} from "./routeAccess";

/** Routes rendered outside the tenant app shell (auth flows, platform apex). */
const OUTSIDE_APP_SHELL = new Set<string>([
  ROUTES.forcePasswordChange,
  ROUTES.institutionSetup,
  ROUTES.login,
  ROUTES.forgotPassword,
  ROUTES.twoFactor,
  ROUTES.onboarding,
  ROUTES.tenantNotFound,
  ROUTES.platformLogin,
  ROUTES.platformForgotPassword,
  ROUTES.platformAccount,
  ROUTES.platformAdmins,
  ROUTES.platformUsers,
  ROUTES.platformSettings,
  ROUTES.platformDashboard,
  ROUTES.platformWorkspaces,
  ROUTES.platformReports,
  ROUTES.platformActivityLogs,
  ROUTES.platformSystem,
  ROUTES.platformErd,
  ROUTES.platformDesignSystem,
]);

function evaluator(
  granted: Record<string, boolean> | null,
  enabled: Record<string, boolean> | null,
  role: string,
): ModuleAccessEvaluator {
  const availability = buildModuleAvailability(granted, enabled);
  return (moduleId, action) =>
    evaluateModuleAccess({
      moduleId,
      availability,
      can: (p) => roleHasPermission(role, p),
      action,
    });
}

describe("TENANT_APP_ROUTE_ACCESS", () => {
  it("explicitly classifies every tenant route, so new routes cannot bypass the guard", () => {
    const unclassified = Object.values(ROUTES).filter(
      (path) => !OUTSIDE_APP_SHELL.has(path) && !(path in TENANT_APP_ROUTE_ACCESS),
    );
    expect(unclassified).toEqual([]);
  });

  it("gives every sidebar destination an explicit rule", () => {
    const paths = NAV_ITEMS.flatMap((item) => [
      item.path,
      ...(item.subItems?.map((s) => s.path) ?? []),
    ]);
    expect(
      paths.filter((path) => path !== undefined && !(path in TENANT_APP_ROUTE_ACCESS)),
    ).toEqual([]);
  });

  it("covers every access-controlled module with a route", () => {
    const modules = new Set(
      Object.values(TENANT_APP_ROUTE_ACCESS).flatMap((rule) =>
        rule.kind === "open" ? [] : [rule.moduleId],
      ),
    );
    expect([...modules].sort()).toEqual([...ACCESS_CONTROLLED_MODULE_IDS].sort());
  });
});

describe("resolveRouteAccess", () => {
  it("denies a module the platform has not granted even when the tenant enabled it", () => {
    const decision = resolveRouteAccess(
      ROUTES.finance,
      evaluator({ finance: false }, { finance: true }, "admin"),
    );
    expect(decision).toEqual({ allowed: false, code: "MODULE_NOT_GRANTED", moduleId: "finance" });
  });

  it("denies a disabled module even when the user has permission", () => {
    const decision = resolveRouteAccess(
      ROUTES.finance,
      evaluator(null, { finance: false }, "admin"),
    );
    expect(decision).toEqual({ allowed: false, code: "MODULE_DISABLED", moduleId: "finance" });
  });

  it("denies an enabled module when the read permission is missing", () => {
    const decision = resolveRouteAccess(ROUTES.accounting, evaluator(null, null, "teacher"));
    expect(decision).toEqual({ allowed: false, code: "PERMISSION_DENIED", moduleId: "accounting" });
  });

  it("allows a module when grant, enablement, and permission are satisfied", () => {
    expect(resolveRouteAccess(ROUTES.students, evaluator(null, null, "teacher"))).toEqual({
      allowed: true,
      moduleId: "students",
    });
  });

  it("applies the parent module rule to nested, detail, and create/edit paths", () => {
    const evaluate = evaluator(null, { examination: false }, "admin");
    for (const path of [
      `${ROUTES.examinations}/e-1`,
      `${ROUTES.examinations}/new`,
      `${ROUTES.examinations}/e-1/edit`,
    ]) {
      expect(resolveRouteAccess(path, evaluate)).toMatchObject({
        allowed: false,
        code: "MODULE_DISABLED",
      });
    }
  });

  it("keeps Home, Profile, and Settings reachable whatever the module state", () => {
    const evaluate = evaluator({ dashboard: false }, null, "guardian");
    expect(resolveRouteAccess(ROUTES.home, evaluate)).toEqual({ allowed: true });
    expect(resolveRouteAccess(ROUTES.profile, evaluate)).toEqual({ allowed: true });
    expect(resolveRouteAccess(ROUTES.settings, evaluate)).toEqual({ allowed: true });
  });

  it("fails closed for unknown app-shell paths and while availability is unknown", () => {
    expect(findRouteAccessRule("/unknown-module")).toBeUndefined();
    expect(resolveRouteAccess("/unknown-module", () => ({ allowed: true }))).toEqual({
      allowed: false,
      code: "MODULE_NOT_GRANTED",
    });
    const pending: ModuleAccessEvaluator = (moduleId, action) =>
      evaluateModuleAccess({ moduleId, availability: null, can: () => true, action });
    expect(resolveRouteAccess(ROUTES.students, pending)).toMatchObject({
      allowed: false,
      code: "MODULE_ACCESS_UNAVAILABLE",
    });
  });
});

describe("canShowRoute", () => {
  it("hides Home only when its module is not readable, and never hides open routes", () => {
    expect(canShowRoute(ROUTES.home, evaluator(null, null, "teacher"))).toBe(true);
    expect(canShowRoute(ROUTES.home, evaluator(null, null, "guardian"))).toBe(false);
    expect(canShowRoute(ROUTES.settings, evaluator(null, null, "guardian"))).toBe(true);
    expect(canShowRoute("/unknown-module", () => ({ allowed: true }))).toBe(false);
  });
});
