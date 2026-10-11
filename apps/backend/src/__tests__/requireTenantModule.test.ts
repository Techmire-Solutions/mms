import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockModuleRow = vi.fn();
vi.mock("../db/repositories/workspaceModuleAccessRepository.js", () => ({
  getWorkspaceModuleAccessRow: (...args: unknown[]) => mockModuleRow(...args),
}));

const mockRoleMatrix = vi.fn();
vi.mock("../services/rbacService.js", () => ({
  getTenantRoleMatrix: (...args: unknown[]) => mockRoleMatrix(...args),
}));

import { resolveModuleRouteAction } from "../lib/moduleRouteActions.js";
import {
  ModuleAvailabilityUnavailableError,
  clearModuleAvailabilityCache,
  loadModuleAvailability,
} from "../lib/moduleAvailabilityService.js";
import {
  backgroundJobModuleAction,
  getBackgroundJobModuleDenial,
} from "../lib/backgroundJobModuleAccess.js";

describe("resolveModuleRouteAction", () => {
  it("defaults reads to read and mutations to write", () => {
    expect(resolveModuleRouteAction("GET", "/api/students/:id", "students")).toBe("read");
    expect(resolveModuleRouteAction("HEAD", "/api/students", "students")).toBe("read");
    expect(resolveModuleRouteAction("POST", "/api/students", "students")).toBe("write");
    expect(resolveModuleRouteAction("DELETE", "/api/students/:id", "students")).toBe("write");
    expect(resolveModuleRouteAction(["GET", "PUT"], "/api/students/bulk", "students")).toBe(
      "write",
    );
  });

  it("classifies POST endpoints that only read or export", () => {
    expect(resolveModuleRouteAction("POST", "/api/students/widget-aggregates", "students")).toBe(
      "read",
    );
    expect(resolveModuleRouteAction("POST", "/api/v1/tenant/faculty/resolve", "faculty")).toBe(
      "read",
    );
    expect(resolveModuleRouteAction("POST", "/api/contacts/duplicates/scan", "contacts")).toBe(
      "read",
    );
    expect(resolveModuleRouteAction("DELETE", "/api/contacts/saved-reports/:id", "contacts")).toBe(
      "read",
    );
    expect(resolveModuleRouteAction("POST", "/api/students/export/csv", "students")).toBe("export");
    expect(resolveModuleRouteAction("POST", "/api/contacts/export/vcf", "contacts")).toBe("export");
  });

  it("requires setupWrite for module setup mutations except dashboard personal prefs", () => {
    expect(resolveModuleRouteAction("PUT", "/api/students/field-config", "students")).toBe(
      "setupWrite",
    );
    expect(resolveModuleRouteAction("PUT", "/api/users/config/preferences", "users")).toBe(
      "setupWrite",
    );
    expect(resolveModuleRouteAction("PUT", "/api/sessions/lookups/:kind", "sessions")).toBe(
      "setupWrite",
    );
    expect(resolveModuleRouteAction("POST", "/api/faculty/setup-audit", "faculty")).toBe(
      "setupWrite",
    );
    expect(resolveModuleRouteAction("PUT", "/api/dashboard/preferences", "dashboard")).toBe(
      "availability",
    );
  });

  it("leaves handler-owned permissions to the handler but still gates availability", () => {
    expect(resolveModuleRouteAction("PUT", "/api/contacts/:id", "contacts")).toBe("availability");
    expect(resolveModuleRouteAction("GET", "/api/users/activity", "users")).toBe("availability");
    expect(resolveModuleRouteAction("PUT", "/api/users/activity/bulk", "users")).toBe(
      "availability",
    );
    expect(resolveModuleRouteAction("PUT", "/api/students/:id", "students")).toBe("write");
  });

  it("lets an explicit route declaration win", () => {
    expect(resolveModuleRouteAction("POST", "/api/students/custom", "students", "read")).toBe(
      "read",
    );
  });
});

describe("loadModuleAvailability", () => {
  beforeEach(() => clearModuleAvailabilityCache());
  afterEach(() => vi.unstubAllEnvs());

  it("builds availability from the workspace row and caches it per tenant", async () => {
    mockModuleRow.mockResolvedValue({
      grantedModules: { finance: false },
      enabledModules: { hasanat: false },
    });

    const first = await loadModuleAvailability("Demo");
    await loadModuleAvailability("demo");

    expect(first.finance).toEqual({ granted: false, enabled: false });
    expect(first.hasanat).toEqual({ granted: true, enabled: false });
    expect(mockModuleRow).toHaveBeenCalledTimes(1);
  });

  it("re-reads after the tenant cache is cleared", async () => {
    mockModuleRow.mockResolvedValueOnce({ grantedModules: null, enabledModules: null });
    await loadModuleAvailability("demo");
    mockModuleRow.mockResolvedValueOnce({
      grantedModules: null,
      enabledModules: { finance: false },
    });

    clearModuleAvailabilityCache("demo");
    const next = await loadModuleAvailability("demo");

    expect(next.finance.enabled).toBe(false);
  });

  it("fails closed outside the test runtime when the row cannot be read", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    mockModuleRow.mockRejectedValue(new Error("db down"));

    await expect(loadModuleAvailability("demo")).rejects.toBeInstanceOf(
      ModuleAvailabilityUnavailableError,
    );
  });

  it("fails closed outside the test runtime when the workspace row is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    mockModuleRow.mockResolvedValue(null);

    await expect(loadModuleAvailability("ghost")).rejects.toBeInstanceOf(
      ModuleAvailabilityUnavailableError,
    );
  });
});

describe("background job module gate", () => {
  beforeEach(() => {
    clearModuleAvailabilityCache();
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: null });
    mockRoleMatrix.mockResolvedValue({ "u-1": { role: "teacher", deletedAt: null } });
  });

  it("maps runner kinds to module actions", () => {
    expect(backgroundJobModuleAction("export")).toBe("export");
    expect(backgroundJobModuleAction("export-vcf")).toBe("export");
    expect(backgroundJobModuleAction("import")).toBe("write");
    expect(backgroundJobModuleAction("duplicate-scan")).toBe("read");
  });

  it("allows a job whose module and permission are still in place", async () => {
    expect(await getBackgroundJobModuleDenial("demo", "u-1", "students", "export")).toBeNull();
  });

  it("denies a job when its module was disabled after enqueueing", async () => {
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: { finance: false } });
    expect(await getBackgroundJobModuleDenial("demo", "u-1", "finance", "collect")).toBe(
      "MODULE_DISABLED",
    );
  });

  it("denies a job when the user no longer holds the permission", async () => {
    expect(await getBackgroundJobModuleDenial("demo", "u-1", "contacts", "export")).toBe(
      "PERMISSION_DENIED",
    );
  });

  it("resolves manifest module ids used by job runners", async () => {
    mockModuleRow.mockResolvedValue({
      grantedModules: null,
      enabledModules: { enrollment: false },
    });
    expect(await getBackgroundJobModuleDenial("demo", "u-1", "enrollments", "export")).toBe(
      "MODULE_DISABLED",
    );
  });

  it("fails closed outside the test runtime when the role matrix is unreadable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    mockRoleMatrix.mockRejectedValue(new Error("redis down"));
    try {
      expect(await getBackgroundJobModuleDenial("demo", "u-1", "students", "export")).toBe(
        "MODULE_ACCESS_UNAVAILABLE",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
