import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken, viewerToken } from "./helpers/tokens.js";

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
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockLoadUserFieldConfig = vi.fn();
const mockSaveUserFieldConfig = vi.fn();
const mockLoadUserModulePreferences = vi.fn();
const mockSaveUserModulePreferences = vi.fn();

vi.mock("../services/userConfigService.js", () => ({
  loadUserFieldConfig: (...args: unknown[]) => mockLoadUserFieldConfig(...args),
  saveUserFieldConfig: (...args: unknown[]) => mockSaveUserFieldConfig(...args),
}));

vi.mock("../services/userPreferencesService.js", () => ({
  loadUserModulePreferences: (...args: unknown[]) => mockLoadUserModulePreferences(...args),
  saveUserModulePreferences: (...args: unknown[]) => mockSaveUserModulePreferences(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

describe("users Setup routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("GET/PUT /api/users/field-config and /preferences require manage / setup permissions", async () => {
    mockLoadUserFieldConfig.mockResolvedValue({ version: 1, enabledTabs: ["basic"], fields: {} });
    mockSaveUserFieldConfig.mockResolvedValue({ version: 1, enabledTabs: ["basic"], fields: {} });
    mockLoadUserModulePreferences.mockResolvedValue({
      allowSelfRegistration: false,
      requireEmailVerification: true,
      defaultViewLayout: "table",
      workspaceRoles: [],
    });
    mockSaveUserModulePreferences.mockResolvedValue({
      allowSelfRegistration: false,
      requireEmailVerification: true,
      defaultViewLayout: "table",
      workspaceRoles: [],
    });

    const app = await buildApp();

    const fieldReadDeniedViewer = await app.inject({
      method: "GET",
      url: "/api/users/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(fieldReadDeniedViewer.statusCode).toBe(403);

    const fieldReadDeniedTeacher = await app.inject({
      method: "GET",
      url: "/api/users/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(fieldReadDeniedTeacher.statusCode).toBe(403);

    const fieldReadOk = await app.inject({
      method: "GET",
      url: "/api/users/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(fieldReadOk.statusCode).toBe(200);

    const fieldWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/users/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["basic"], fields: {} },
    });
    expect(fieldWriteDenied.statusCode).toBe(403);

    const fieldWriteOk = await app.inject({
      method: "PUT",
      url: "/api/users/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["basic"], fields: {} },
    });
    expect(fieldWriteOk.statusCode).toBe(200);
    expect(mockSaveUserFieldConfig).toHaveBeenCalled();

    const prefsWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/users/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { requireEmailVerification: true },
    });
    expect(prefsWriteDenied.statusCode).toBe(403);

    const prefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/users/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { requireEmailVerification: true },
    });
    expect(prefsWriteOk.statusCode).toBe(200);
    expect(mockSaveUserModulePreferences).toHaveBeenCalled();

    // Verify /api/users/config/preferences alias (used by frontend client)
    const configPrefsReadOk = await app.inject({
      method: "GET",
      url: "/api/users/config/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(configPrefsReadOk.statusCode).toBe(200);
    const configPrefsBody = JSON.parse(configPrefsReadOk.body);
    expect(configPrefsBody).toHaveProperty("preferences");

    // Verify /api/users/config/preferences PUT
    const configPrefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/users/config/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { requireEmailVerification: true },
    });
    expect(configPrefsWriteOk.statusCode).toBe(200);

    // Verify /api/users/config/fields GET & PUT
    const configFieldsReadOk = await app.inject({
      method: "GET",
      url: "/api/users/config/fields",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(configFieldsReadOk.statusCode).toBe(200);

    const configFieldsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/users/config/fields",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["basic"], fields: {} },
    });
    expect(configFieldsWriteOk.statusCode).toBe(200);

    // Verify /api/users/config/composed GET
    const composedReadOk = await app.inject({
      method: "GET",
      url: "/api/users/config/composed",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(composedReadOk.statusCode).toBe(200);

    await app.close();
  });
});
