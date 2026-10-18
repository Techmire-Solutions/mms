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

const mockLoadSessionFieldConfig = vi.fn();
const mockSaveSessionFieldConfig = vi.fn();
const mockLoadSessionModulePreferences = vi.fn();
const mockSaveSessionModulePreferences = vi.fn();

vi.mock("../services/sessionConfigService.js", () => ({
  loadSessionFieldConfig: (...args: unknown[]) => mockLoadSessionFieldConfig(...args),
  saveSessionFieldConfig: (...args: unknown[]) => mockSaveSessionFieldConfig(...args),
  loadSessionsSettingsCombined: (...args: unknown[]) => mockLoadSessionFieldConfig(...args),
}));

vi.mock("../services/sessionPreferencesService.js", () => ({
  loadSessionModulePreferences: (...args: unknown[]) => mockLoadSessionModulePreferences(...args),
  saveSessionModulePreferences: (...args: unknown[]) => mockSaveSessionModulePreferences(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

describe("sessions Setup routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("GET/PUT /api/sessions/field-config and /preferences require setup permissions", async () => {
    mockLoadSessionFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: ["basic"],
      fields: {},
    });
    mockSaveSessionFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: ["basic"],
      fields: {},
    });
    mockLoadSessionModulePreferences.mockResolvedValue({
      defaultDuration: "60",
      defaultSessionType: "class",
      allowOverlap: false,
      archiveOldSessions: false,
      requireBudget: false,
      timetableConflictCheck: true,
      notifyOnSessionStart: false,
      academicYear: "2026",
      sessionStart: "",
      defaultViewLayout: "table",
    });
    mockSaveSessionModulePreferences.mockResolvedValue({
      defaultDuration: "45",
      defaultSessionType: "class",
      allowOverlap: false,
      archiveOldSessions: false,
      requireBudget: false,
      timetableConflictCheck: true,
      notifyOnSessionStart: false,
      academicYear: "2026",
      sessionStart: "",
      defaultViewLayout: "table",
    });

    const app = await buildApp();

    const fieldReadDenied = await app.inject({
      method: "GET",
      url: "/api/sessions/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(fieldReadDenied.statusCode).toBe(403);

    const fieldReadOk = await app.inject({
      method: "GET",
      url: "/api/sessions/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(fieldReadOk.statusCode).toBe(200);

    const fieldWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/sessions/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["basic"], fields: {} },
    });
    expect(fieldWriteDenied.statusCode).toBe(403);

    const fieldWriteOk = await app.inject({
      method: "PUT",
      url: "/api/sessions/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { version: 1, enabledTabs: ["basic"], fields: {} },
    });
    expect(fieldWriteOk.statusCode).toBe(200);
    expect(mockSaveSessionFieldConfig).toHaveBeenCalled();

    const prefsWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/sessions/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { defaultDuration: "45" },
    });
    expect(prefsWriteDenied.statusCode).toBe(403);

    const prefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/sessions/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { defaultDuration: "45" },
    });
    expect(prefsWriteOk.statusCode).toBe(200);
    expect(mockSaveSessionModulePreferences).toHaveBeenCalled();
    await app.close();
  });
});
