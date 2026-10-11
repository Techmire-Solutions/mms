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

const mockLoadEnrollmentFieldConfig = vi.fn();
const mockSaveEnrollmentFieldConfig = vi.fn();
const mockLoadEnrollmentModulePreferences = vi.fn();
const mockSaveEnrollmentModulePreferences = vi.fn();

vi.mock("../services/enrollmentConfigService.js", () => ({
  loadEnrollmentFieldConfig: (...args: unknown[]) => mockLoadEnrollmentFieldConfig(...args),
  saveEnrollmentFieldConfig: (...args: unknown[]) => mockSaveEnrollmentFieldConfig(...args),
  loadEnrollmentsSettingsCombined: (...args: unknown[]) => mockLoadEnrollmentFieldConfig(...args),
}));

vi.mock("../services/enrollmentPreferencesService.js", () => ({
  loadEnrollmentModulePreferences: (...args: unknown[]) =>
    mockLoadEnrollmentModulePreferences(...args),
  saveEnrollmentModulePreferences: (...args: unknown[]) =>
    mockSaveEnrollmentModulePreferences(...args),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

describe("enrollments Setup routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("GET/PUT /api/enrollments/field-config and /preferences require setup permissions", async () => {
    mockLoadEnrollmentFieldConfig.mockResolvedValue({
      fields: { notes: { enabled: true, required: false } },
      customFields: [],
      fieldOrder: ["notes"],
    });
    mockSaveEnrollmentFieldConfig.mockResolvedValue({
      fields: { notes: { enabled: true, required: false } },
      customFields: [],
      fieldOrder: ["notes"],
    });
    mockLoadEnrollmentModulePreferences.mockResolvedValue({
      maxStudentsPerClass: "30",
      waitlistEnabled: true,
      requireEligibilityCheck: true,
      autoAssignClass: false,
      enrollmentApproval: true,
      allowTransfers: true,
      dropDeadlineDays: "14",
      reenrollmentReminder: true,
      defaultViewLayout: "list",
    });
    mockSaveEnrollmentModulePreferences.mockResolvedValue({
      maxStudentsPerClass: "25",
      waitlistEnabled: true,
      requireEligibilityCheck: true,
      autoAssignClass: false,
      enrollmentApproval: true,
      allowTransfers: true,
      dropDeadlineDays: "14",
      reenrollmentReminder: true,
      defaultViewLayout: "list",
    });

    const app = await buildApp();

    const fieldReadDenied = await app.inject({
      method: "GET",
      url: "/api/enrollments/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(fieldReadDenied.statusCode).toBe(403);

    const fieldReadOk = await app.inject({
      method: "GET",
      url: "/api/enrollments/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(fieldReadOk.statusCode).toBe(200);

    const fieldWriteDenied = await app.inject({
      method: "PUT",
      url: "/api/enrollments/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { fields: {}, customFields: [], fieldOrder: [] },
    });
    expect(fieldWriteDenied.statusCode).toBe(403);

    const fieldWriteOk = await app.inject({
      method: "PUT",
      url: "/api/enrollments/field-config",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { fields: {}, customFields: [], fieldOrder: [] },
    });
    expect(fieldWriteOk.statusCode).toBe(200);
    expect(mockSaveEnrollmentFieldConfig).toHaveBeenCalled();

    const prefsWriteOk = await app.inject({
      method: "PUT",
      url: "/api/enrollments/preferences",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { maxStudentsPerClass: "25" },
    });
    expect(prefsWriteOk.statusCode).toBe(200);
    expect(mockSaveEnrollmentModulePreferences).toHaveBeenCalled();
    await app.close();
  });
});
