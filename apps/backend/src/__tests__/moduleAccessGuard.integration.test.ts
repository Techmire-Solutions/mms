import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, signTenantToken, teacherToken } from "./helpers/tokens.js";

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

const mockLoadStudentsPage = vi.fn();
const mockBulkSoftDeleteStudents = vi.fn();
vi.mock("../students/use-cases/studentUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../students/use-cases/studentUseCases.js")>();
  return {
    ...actual,
    studentUseCases: {
      ...actual.studentUseCases,
      loadStudentsPage: (...args: unknown[]) => mockLoadStudentsPage(...args),
      bulkSoftDeleteStudents: (...args: unknown[]) => mockBulkSoftDeleteStudents(...args),
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

const mockLoadDashboardSummary = vi.fn();
vi.mock("../services/dashboardSummaryService.js", () => ({
  loadDashboardSummary: (...args: unknown[]) => mockLoadDashboardSummary(...args),
}));

import { broadcastTenantUpdate } from "../lib/livePush.js";
import { clearModuleAvailabilityCache } from "../lib/moduleAvailabilityService.js";

const HOST = { host: "demo.localhost" };
const matrix = (overrides: Record<string, string> = {}) => ({
  "u-admin": { role: overrides["u-admin"] ?? "admin", deletedAt: null },
  "u-teacher": { role: overrides["u-teacher"] ?? "teacher", deletedAt: null },
  "u-accountant": { role: overrides["u-accountant"] ?? "accountant", deletedAt: null },
});

async function call(
  method: "GET" | "POST",
  url: string,
  token: (app: Awaited<ReturnType<typeof buildApp>>) => string,
  payload?: unknown,
) {
  const app = await buildApp();
  const res = await app.inject({
    method,
    url,
    headers: {
      ...HOST,
      authorization: `Bearer ${token(app)}`,
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    ...(payload ? { payload: payload as Record<string, unknown> } : {}),
  });
  await app.close();
  return res;
}

describe("module access guard (direct API requests)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    clearModuleAvailabilityCache();
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: null });
    mockRoleMatrix.mockResolvedValue(matrix());
    mockLoadStudentsPage.mockResolvedValue({
      students: [],
      total: 0,
      page: 1,
      limit: 25,
      hasMore: false,
    });
    mockBulkSoftDeleteStudents.mockResolvedValue({ succeeded: 1, failed: 0 });
  });

  it("denies a module the platform has not granted even when the tenant enabled it", async () => {
    mockModuleRow.mockResolvedValue({
      grantedModules: { finance: false },
      enabledModules: { finance: true },
    });
    const res = await call("GET", "/api/finance/invoices", adminToken);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      type: "forbidden",
      code: "MODULE_NOT_GRANTED",
      moduleId: "finance",
      message: "The finance module is not permitted by the platform.",
    });
  });

  it("denies a disabled module even for an admin with every permission", async () => {
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: { finance: false } });
    const res = await call("GET", "/api/finance/invoices", adminToken);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: "MODULE_DISABLED", moduleId: "finance" });
  });

  it("denies reads when the module is enabled but the read permission is missing", async () => {
    const res = await call("GET", "/api/accounting/accounts", teacherToken);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: "PERMISSION_DENIED", moduleId: "accounting" });
  });

  it("denies writes lacking the write permission before any side effect", async () => {
    const res = await call("POST", "/api/students/bulk-delete", accountantToken, { ids: ["s1"] });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: "PERMISSION_DENIED", moduleId: "students" });
    expect(mockBulkSoftDeleteStudents).not.toHaveBeenCalled();
  });

  it("allows reads and writes when grant, enablement, and permission are satisfied", async () => {
    const read = await call("GET", "/api/students", teacherToken);
    expect(read.statusCode).toBe(200);
    const write = await call("POST", "/api/students/bulk-delete", adminToken, { ids: ["s1"] });
    expect(write.statusCode).toBe(200);
    expect(mockBulkSoftDeleteStudents).toHaveBeenCalledTimes(1);
  });

  it("applies the gate to aliased and nested module routes", async () => {
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: { faculty: false } });
    for (const url of [
      "/api/faculty",
      "/api/v1/tenant/faculty",
      "/api/tenant/faculty/lookups",
      "/api/faculty/departments",
    ]) {
      const res = await call("GET", url, adminToken);
      expect(res.statusCode, url).toBe(403);
      expect(res.json(), url).toMatchObject({ code: "MODULE_DISABLED", moduleId: "faculty" });
    }
  });

  it("rejects a token from another workspace without reading module data", async () => {
    const res = await call("GET", "/api/students", (app) =>
      signTenantToken(app, { role: "admin", id: "u-admin", workspaceSubdomain: "other" }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockLoadStudentsPage).not.toHaveBeenCalled();
  });

  it("applies a module being disabled mid-session on the next request, without logout", async () => {
    expect((await call("GET", "/api/hasanat/batches", adminToken)).statusCode).not.toBe(403);
    mockModuleRow.mockResolvedValue({ grantedModules: null, enabledModules: { hasanat: false } });
    broadcastTenantUpdate("demo", "object", "global_settings");
    const res = await call("GET", "/api/hasanat/batches", adminToken);
    expect(res.json()).toMatchObject({ code: "MODULE_DISABLED", moduleId: "hasanat" });
  });

  it("uses the current role, so a demotion applies before the token expires", async () => {
    mockRoleMatrix.mockResolvedValue(matrix({ "u-admin": "teacher" }));
    const res = await call("GET", "/api/accounting/accounts", adminToken);
    expect(res.json()).toMatchObject({ code: "PERMISSION_DENIED", moduleId: "accounting" });
  });

  it("strips dashboard summary sections the caller may not read", async () => {
    mockLoadDashboardSummary.mockResolvedValue({
      students: { total: 1 },
      finance: { due: 5 },
      accounting: { cash: 9 },
      hasanat: { cards: 2 },
    });
    mockModuleRow.mockResolvedValue({ grantedModules: { hasanat: false }, enabledModules: null });
    const res = await call("GET", "/api/dashboard/summary", teacherToken);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().summary).toEqual({ students: { total: 1 } });
  });

  it("serves authoritative module availability to any signed-in user", async () => {
    mockModuleRow.mockResolvedValue({
      grantedModules: { accounting: false },
      enabledModules: { finance: false },
    });
    const res = await call("GET", "/api/module-access", teacherToken);
    expect(res.statusCode).toBe(200);
    const { modules } = res.json() as {
      modules: Record<string, { granted: boolean; enabled: boolean }>;
    };
    expect(modules.accounting).toEqual({ granted: false, enabled: false });
    expect(modules.finance).toEqual({ granted: true, enabled: false });
    expect(modules.students).toEqual({ granted: true, enabled: true });
  });
});
