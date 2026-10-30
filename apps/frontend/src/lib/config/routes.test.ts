import { describe, expect, it } from "vitest";
import {
  ROUTES,
  tenantNotFoundPath,
  isPlatformWorkspaceGatePath,
  isPlatformEntryPath,
  isEntryPath,
  isSettingsSection,
  isNavPathActive,
  isTenantAppPath,
  SETTINGS_SECTIONS,
} from "@/lib/config/routes";
import { TENANT_APP_ENTRIES, TENANT_PATHS } from "@/lib/routing/moduleRegistry";

describe("tenantNotFoundPath", () => {
  it("builds the redirect path with a subdomain query param", () => {
    expect(tenantNotFoundPath("al-noor")).toBe("/tenant-not-found?subdomain=al-noor");
  });
});

describe("isPlatformWorkspaceGatePath", () => {
  it("treats settings and tenant app paths as workspace gates", () => {
    expect(isPlatformWorkspaceGatePath("/settings")).toBe(true);
    expect(isPlatformWorkspaceGatePath("/settings/branding")).toBe(true);
    expect(isPlatformWorkspaceGatePath("/students")).toBe(true);
  });

  it("returns false for non-gate paths", () => {
    expect(isPlatformWorkspaceGatePath("/login")).toBe(false);
  });
});

describe("isPlatformEntryPath", () => {
  it("returns true for platform entry paths", () => {
    expect(isPlatformEntryPath("/login")).toBe(true);
    expect(isPlatformEntryPath("/platform/login")).toBe(true);
    expect(isPlatformEntryPath("/tenant-not-found")).toBe(true);
  });

  it("returns true for workspace gate paths", () => {
    expect(isPlatformEntryPath("/students")).toBe(true);
  });

  it("returns false for unknown paths", () => {
    expect(isPlatformEntryPath("/nope")).toBe(false);
  });
});

describe("isEntryPath", () => {
  it("returns true for tenant auth entry paths", () => {
    expect(isEntryPath("/login")).toBe(true);
    expect(isEntryPath("/forgot-password")).toBe(true);
    expect(isEntryPath("/2fa")).toBe(true);
  });

  it("returns true for onboarding", () => {
    expect(isEntryPath("/onboarding")).toBe(true);
  });

  it("returns false for app paths", () => {
    expect(isEntryPath("/students")).toBe(false);
  });

  it("delegates to platform entry when isApex is set", () => {
    expect(isEntryPath("/students", { isApex: true })).toBe(true);
  });
});

describe("isSettingsSection", () => {
  it("accepts known sections and rejects others", () => {
    expect(isSettingsSection("branding")).toBe(true);
    expect(isSettingsSection("nope")).toBe(false);
  });

  it("exposes the settings section list", () => {
    expect(SETTINGS_SECTIONS).toContain("global");
    expect(SETTINGS_SECTIONS).toContain("backup");
  });
});

describe("isNavPathActive", () => {
  it("matches exact and nested paths", () => {
    expect(isNavPathActive("/students", "/students")).toBe(true);
    expect(isNavPathActive("/students/123", "/students")).toBe(true);
  });

  it("home only matches exactly", () => {
    expect(isNavPathActive("/", ROUTES.home)).toBe(true);
    expect(isNavPathActive("/students", ROUTES.home)).toBe(false);
  });
});

describe("isTenantAppPath", () => {
  it("matches tenant module paths", () => {
    expect(isTenantAppPath("/contacts")).toBe(true);
    expect(isTenantAppPath("/finance/123")).toBe(true);
  });

  it("rejects non-tenant paths", () => {
    expect(isTenantAppPath("/login")).toBe(false);
    expect(isTenantAppPath("/platform/dashboard")).toBe(false);
  });
});

describe("ROUTES tenant registry parity", () => {
  it("given the tenant module registry, should expose every registered path when read from ROUTES", () => {
    // Arrange
    const routeValues = new Set<string>(Object.values(ROUTES));

    // Act
    const missingPaths = Object.values(TENANT_PATHS).filter((path) => !routeValues.has(path));
    const missingEntries = TENANT_APP_ENTRIES.filter((entry) => !routeValues.has(entry.path)).map(
      (entry) => entry.path,
    );

    // Assert
    expect(missingPaths).toEqual([]);
    expect(missingEntries).toEqual([]);
  });

  it("given a registered module id, should map it to the same path when read from ROUTES", () => {
    // Arrange
    const workshopsEntry = TENANT_APP_ENTRIES.find((entry) => entry.id === "workshops");

    // Act
    const registeredPath = workshopsEntry?.path;

    // Assert
    expect(registeredPath).toBe(TENANT_PATHS.workshops);
    expect(Object.values(ROUTES)).toContain(registeredPath);
  });
});
