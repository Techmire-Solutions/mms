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

const mockLoadStudentsPage = vi.fn();
const mockBulkSoftDeleteStudents = vi.fn();
const mockBulkRestoreStudents = vi.fn();
const mockBulkUpdateStudentStatus = vi.fn();
const mockGetUserColumnPreferencesForModule = vi.fn();
const mockSetUserColumnPreferencesForModule = vi.fn();
const mockRecordAudit = vi.fn();

vi.mock("../students/use-cases/studentUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../students/use-cases/studentUseCases.js")>();
  return {
    ...actual,
    studentUseCases: {
      ...actual.studentUseCases,
      loadStudentsPage: (...args: unknown[]) => mockLoadStudentsPage(...args),
      bulkSoftDeleteStudents: (...args: unknown[]) => mockBulkSoftDeleteStudents(...args),
      bulkRestoreStudents: (...args: unknown[]) => mockBulkRestoreStudents(...args),
      bulkUpdateStudentStatus: (...args: unknown[]) => mockBulkUpdateStudentStatus(...args),
      sanitizeStudentsForViewer: async (students: unknown) => students,
    },
  };
});

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (first: unknown, second?: unknown) => {
    const input = (second ?? first) as {
      realUserId?: string;
      tableName?: string;
      recordId?: string;
      newState?: { action?: string; summary?: string };
    };
    mockRecordAudit({
      userId: input.realUserId,
      action: input.newState?.action,
      entityType: "collection",
      entityId: input.recordId,
      summary: input.newState?.summary,
    });
    return Promise.resolve({
      hashPrevious: "0".repeat(64),
      hashCurrent: "1".repeat(64),
      canonicalPayload: "{}",
    });
  },
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") || action.includes("archive")
      ? "DELETE"
      : action.includes("create")
        ? "CREATE"
        : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

vi.mock("../services/userColumnPreferencesService.js", () => ({
  getUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockGetUserColumnPreferencesForModule(...args),
  setUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockSetUserColumnPreferencesForModule(...args),
}));

describe("students trash / bulk / column-preferences routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
    mockRecordAudit.mockResolvedValue(undefined);
  });

  it("GET /api/students?includeDeleted=true returns 403 without students.delete", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/students?page=1&limit=50&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadStudentsPage).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/students/bulk-delete denies teachers without students.delete", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"] },
    });
    expect(res.statusCode).toBe(403);
    expect(mockBulkSoftDeleteStudents).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/students/bulk-delete soft-deletes for admin", async () => {
    mockBulkSoftDeleteStudents.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"], deletionReason: "duplicate" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkSoftDeleteStudents).toHaveBeenCalledWith(["s-1"], "u-admin", "duplicate");
    expect(res.json()).toEqual({ success: true, succeeded: 1, failed: 0 });
    await app.close();
  });

  it("POST /api/students/bulk-restore denies teachers without students.delete", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"] },
    });
    expect(res.statusCode).toBe(403);
    expect(mockBulkRestoreStudents).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/students/bulk-restore restores for admin", async () => {
    mockBulkRestoreStudents.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"] },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkRestoreStudents).toHaveBeenCalledWith(["s-1"], "u-admin");
    await app.close();
  });

  it("POST /api/students/bulk-status denies viewers", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"], status: "inactive" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockBulkUpdateStudentStatus).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/students/bulk-status updates for teacher writers", async () => {
    mockBulkUpdateStudentStatus.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-1"], status: "inactive" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkUpdateStudentStatus).toHaveBeenCalledWith(["s-1"], "inactive");
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student.bulk_status",
        summary: expect.stringContaining("Updated status to inactive"),
      }),
    );
    await app.close();
  });
});
