import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/shared";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const { createDemoWorkspaceMock } = await import("./helpers/buildTestMocks.js");
  const { getWorkspaceBySubdomain } = createDemoWorkspaceMock();
  return { ...actual, getWorkspaceBySubdomain };
});

const mockModuleRow = vi.fn();
vi.mock("../db/repositories/workspaceModuleAccessRepository.js", () => ({
  getWorkspaceModuleAccessRow: (...args: unknown[]) => mockModuleRow(...args),
}));

const mockRoleMatrix = vi.fn();
vi.mock("../services/rbacService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/rbacService.js")>();
  return { ...actual, getTenantRoleMatrix: (...args: unknown[]) => mockRoleMatrix(...args) };
});

const mockSettings = vi.fn();
vi.mock("../services/users/usersSettingsService.js", () => ({
  getTenantUsersSettings: (...args: unknown[]) => mockSettings(...args),
}));

// The catalog cache is exercised by its own unit test; here the loader must run
// without Redis so the request path is deterministic.
vi.mock("../lib/cache/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/cache/index.js")>();
  return {
    ...actual,
    getOrSetMultiTier: (
      _tenant: string,
      _domain: string,
      _key: string,
      fetcher: () => Promise<unknown>,
    ) => fetcher(),
  };
});

const mockLoadStudentsPage = vi.fn();
vi.mock("../students/use-cases/studentUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../students/use-cases/studentUseCases.js")>();
  return {
    ...actual,
    studentUseCases: {
      ...actual.studentUseCases,
      loadStudentsPage: (...args: unknown[]) => mockLoadStudentsPage(...args),
      sanitizeStudentsForViewer: async (students: unknown) => students,
    },
  };
});

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi
    .fn()
    .mockResolvedValue({ hashPrevious: "0", hashCurrent: "1", canonicalPayload: "{}" }),
  mapActionStringToAuditType: () => "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";
import { clearModuleAvailabilityCache } from "../lib/moduleAvailabilityService.js";

const HOST = { host: "demo.localhost" };

const compositeRole: WorkspaceRole = {
  id: "faculty_ed_c1",
  labelKey: "nav.tasks",
  descriptionKey: "nav.tasks",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { students: ["read"] },
};

async function request(url: string, role: WorkspaceRole, method: "GET" = "GET") {
  mockSettings.mockResolvedValue({ workspaceRoles: [role] });
  mockRoleMatrix.mockResolvedValue({ "u-composite": { role: role.id, deletedAt: null } });
  const app = await buildApp();
  try {
    const token = signTenantToken(app, {
      id: "u-composite",
      role: "teacher",
      email: "composite@test.com",
    });
    return await app.inject({
      method,
      url,
      headers: { ...HOST, authorization: `Bearer ${token}` },
    });
  } finally {
    await app.close();
  }
}

describe("custom-role authorization (direct API)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    clearModuleAvailabilityCache();
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: null });
    mockLoadStudentsPage.mockResolvedValue({
      students: [],
      total: 0,
      page: 1,
      limit: 25,
      hasMore: false,
    });
  });

  it("allows a designation-managed composite role to read its module", async () => {
    const res = await request("/api/students", compositeRole);

    expect(res.statusCode, res.body).toBe(200);
  });

  it("denies the composite role when the catalog does not grant the permission", async () => {
    const res = await request("/api/students", { ...compositeRole, permissions: {} });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: "PERMISSION_DENIED", moduleId: "students" });
  });

  it("keeps the role catalog out of the /auth/me payload", async () => {
    const res = await request("/api/auth/me", compositeRole);

    expect(res.statusCode).toBe(200);
    expect(res.json().user).not.toHaveProperty("workspaceRoles");
  });
});
