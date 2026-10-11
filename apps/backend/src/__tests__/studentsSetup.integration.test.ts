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

const mockLoadStudentFieldConfig = vi.fn();
const mockSaveStudentFieldConfig = vi.fn();
const mockLoadStudentModulePreferences = vi.fn();
const mockSaveStudentModulePreferences = vi.fn();

vi.mock("../services/studentConfigService.js", () => ({
  loadStudentFieldConfig: (...args: unknown[]) => mockLoadStudentFieldConfig(...args),
  saveStudentFieldConfig: (...args: unknown[]) => mockSaveStudentFieldConfig(...args),
  loadStudentsSettingsCombined: (...args: unknown[]) => mockLoadStudentFieldConfig(...args),
}));

vi.mock("../services/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: (...args: unknown[]) => mockLoadStudentModulePreferences(...args),
  saveStudentModulePreferences: (...args: unknown[]) => mockSaveStudentModulePreferences(...args),
}));

const mockLoadStudentLookupsMap = vi.fn();
const mockReplaceStudentLookupKind = vi.fn();

vi.mock("../services/studentLookupsService.js", () => ({
  loadStudentLookupsMap: (...args: unknown[]) => mockLoadStudentLookupsMap(...args),
  replaceStudentLookupKind: (...args: unknown[]) => mockReplaceStudentLookupKind(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

describe("students Setup routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("GET/PUT /api/students/field-config and /preferences require setup permissions", async () => {
    mockLoadStudentFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: ["registration"],
      fields: {},
    });
    mockSaveStudentFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: ["registration"],
      fields: {},
    });
    mockLoadStudentModulePreferences.mockResolvedValue({
      autoGenerateId: true,
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
    });
    mockSaveStudentModulePreferences.mockResolvedValue({
      autoGenerateId: true,
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
    });

    const app = await buildApp();

    const fieldReadDenied = await app.inject({
      method: "GET",
      url: "/api/students/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(fieldReadDenied.statusCode).toBe(403);

    const fieldReadOk = await app.inject({
      method: "GET",
      url: "/api/students/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(fieldReadOk.statusCode).toBe(200);

    const fieldWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/students/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["registration"], fields: {} },
    });
    expect(fieldWriteDenied.statusCode).toBe(403);

    const fieldWriteOk = await app.inject({
      method: "PUT",
      url: "/api/students/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["registration"], fields: {} },
    });
    expect(fieldWriteOk.statusCode).toBe(200);
    expect(mockSaveStudentFieldConfig).toHaveBeenCalled();

    const prefsWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/students/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { autoGenerateId: false },
    });
    expect(prefsWriteDenied.statusCode).toBe(403);

    const prefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/students/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { autoGenerateId: false, grNumberTemplate: "GR-{seq}" },
    });
    expect(prefsWriteOk.statusCode).toBe(200);
    expect(mockSaveStudentModulePreferences).toHaveBeenCalled();
    await app.close();
  });

  it("GET/PUT /api/students/lookups require read / setupWrite", async () => {
    mockLoadStudentLookupsMap.mockResolvedValue({
      statuses: ["active"],
      genderFilters: ["male", "female"],
      discountTypes: [],
    });
    mockReplaceStudentLookupKind.mockResolvedValue(["active", "inactive"]);

    const app = await buildApp();

    const readDenied = await app.inject({
      method: "GET",
      url: "/api/students/lookups",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(readDenied.statusCode).toBe(403);

    const readOk = await app.inject({
      method: "GET",
      url: "/api/students/lookups",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(readOk.statusCode).toBe(200);
    expect(readOk.json()).toMatchObject({ lookups: { statuses: ["active"] } });

    const writeDenied = await app.inject({
      method: "PUT",
      url: "/api/students/lookups/statuses",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { items: ["active", "inactive"] },
    });
    expect(writeDenied.statusCode).toBe(403);

    const writeOk = await app.inject({
      method: "PUT",
      url: "/api/students/lookups/statuses",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { items: ["active", "inactive"] },
    });
    expect(writeOk.statusCode).toBe(200);
    expect(mockReplaceStudentLookupKind).toHaveBeenCalledWith("statuses", ["active", "inactive"]);
    await app.close();
  });
});
