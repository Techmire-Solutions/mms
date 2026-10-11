import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { adminToken, assistantTeacherToken, bearerAuth } from "./helpers/tokens.js";

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
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

const mockListSavedReportsByOwner = vi.fn();
const mockCreateSavedReportForOwner = vi.fn();
const mockDeleteSavedReportByOwner = vi.fn();
const mockTouchSavedReportRunByOwner = vi.fn();
const mockRecordAudit = vi.fn();

vi.mock("../db/repositories/savedReportsRepository.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../db/repositories/savedReportsRepository.js")>();
  return {
    ...actual,
    listSavedReportsByOwner: (...args: unknown[]) => mockListSavedReportsByOwner(...args),
    createSavedReportForOwner: (...args: unknown[]) => mockCreateSavedReportForOwner(...args),
    deleteSavedReportByOwner: (...args: unknown[]) => mockDeleteSavedReportByOwner(...args),
    touchSavedReportRunByOwner: (...args: unknown[]) => mockTouchSavedReportRunByOwner(...args),
  };
});

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (first: unknown, second?: unknown) => {
    const input = (second ?? first) as {
      realUserId?: string;
      recordId?: string;
      newState?: { action?: string; summary?: string };
    };
    mockRecordAudit({
      userId: input.realUserId,
      action: input.newState?.action,
      entityType: "report",
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
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
}));

const REPORT = {
  id: "report-1",
  name: "Active students",
  category: "students" as const,
  filters: { status: "active" },
  lastRun: "2026-07-30T00:00:00.000Z",
  createdBy: "u-admin",
  createdByName: "Admin User",
  createdAt: "2026-07-30T00:00:00.000Z",
};

describe("generic saved-reports REST routes", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
  });

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockListSavedReportsByOwner.mockReset().mockResolvedValue([REPORT]);
    mockCreateSavedReportForOwner.mockReset().mockResolvedValue(REPORT);
    mockDeleteSavedReportByOwner.mockReset().mockResolvedValue(true);
    mockTouchSavedReportRunByOwner.mockReset().mockResolvedValue(REPORT);
    mockRecordAudit.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/saved-reports?category=students",
      headers: { host: "demo.localhost" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("allows listing personal reports with category module read permission", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/saved-reports?category=students",
      headers: {
        host: "demo.localhost",
        authorization: bearerAuth(
          adminToken(app, { email: "admin@demo.test", name: "Admin User" }),
        ),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reports: [REPORT] });
    expect(mockListSavedReportsByOwner).toHaveBeenCalledWith("demo", "students", "u-admin");
  });

  it("creates a report with the authenticated owner identity", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/saved-reports",
      headers: {
        host: "demo.localhost",
        authorization: bearerAuth(
          adminToken(app, { email: "admin@demo.test", name: "Admin User" }),
        ),
      },
      payload: {
        name: "Active students",
        category: "students",
        filters: { status: "active" },
      },
    });
    expect(response.statusCode).toBe(201);
    expect(mockCreateSavedReportForOwner).toHaveBeenCalledWith("demo", {
      name: "Active students",
      category: "students",
      filters: { status: "active" },
      createdBy: "u-admin",
      createdByName: "Admin User",
    });
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-admin",
        action: "students.saved_report.create",
        entityId: REPORT.id,
      }),
    );
  });

  it("runs and deletes an owned report", async () => {
    const headers = {
      host: "demo.localhost",
      authorization: bearerAuth(adminToken(app, { email: "admin@demo.test", name: "Admin User" })),
    };
    const runResponse = await app.inject({
      method: "POST",
      url: "/api/saved-reports/report-1/run?category=students",
      headers,
    });
    expect(runResponse.statusCode).toBe(200);
    expect(mockTouchSavedReportRunByOwner).toHaveBeenCalledWith(
      "demo",
      "report-1",
      "students",
      "u-admin",
    );

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/saved-reports/report-1?category=students",
      headers,
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ success: true });
    expect(mockDeleteSavedReportByOwner).toHaveBeenCalledWith(
      "demo",
      "report-1",
      "students",
      "u-admin",
    );
    expect(mockRecordAudit).toHaveBeenCalledTimes(2);
  });

  it("denies a category when the role lacks its module read permission", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/saved-reports?category=finance",
      headers: {
        host: "demo.localhost",
        authorization: bearerAuth(
          assistantTeacherToken(app, {
            email: "assistant_teacher@demo.test",
            name: "Assistant User",
          }),
        ),
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      type: "forbidden",
      code: "PERMISSION_DENIED",
      moduleId: "finance",
      message: "Insufficient permissions",
    });
    expect(mockListSavedReportsByOwner).not.toHaveBeenCalled();
  });

  it("returns the same stable 404 for missing or cross-user run and delete", async () => {
    mockTouchSavedReportRunByOwner.mockResolvedValueOnce(null);
    mockDeleteSavedReportByOwner.mockResolvedValueOnce(false);
    const headers = {
      host: "demo.localhost",
      authorization: bearerAuth(adminToken(app, { email: "admin@demo.test", name: "Admin User" })),
    };

    const runResponse = await app.inject({
      method: "POST",
      url: "/api/saved-reports/other-user-report/run?category=students",
      headers,
    });
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/saved-reports/other-user-report?category=students",
      headers,
    });

    expect(runResponse.statusCode).toBe(404);
    expect(deleteResponse.statusCode).toBe(404);
    expect(runResponse.json()).toEqual({
      type: "not_found",
      message: "Saved report not found",
    });
    expect(deleteResponse.json()).toEqual(runResponse.json());
  });
});
