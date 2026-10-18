import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  accountantToken,
  adminToken,
  assistantTeacherToken,
  bearerAuth,
  teacherToken,
  viewerToken,
} from "./helpers/tokens.js";

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

function authHeaders(token: string): Record<string, string> {
  return { host: "demo.localhost", authorization: bearerAuth(token) };
}

describe("savedReportsContractRouter", () => {
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

  describe("list", () => {
    it("returns 200 with only the caller own reports for the category", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/saved-reports?category=students",
        headers: authHeaders(adminToken(app)),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ reports: [REPORT] });
      expect(mockListSavedReportsByOwner).toHaveBeenCalledWith("demo", "students", "u-admin");
    });

    it("allows a role holding the module read permission", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/saved-reports?category=students",
        headers: authHeaders(teacherToken(app)),
      });
      expect(response.statusCode).toBe(200);
      expect(mockListSavedReportsByOwner).toHaveBeenCalledWith("demo", "students", "u-teacher");
    });

    it("denies 403 when the role lacks the module read permission", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/saved-reports?category=students",
        headers: authHeaders(viewerToken(app)),
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        type: "forbidden",
        code: "PERMISSION_DENIED",
        moduleId: "students",
        message: "Insufficient permissions",
      });
      expect(mockListSavedReportsByOwner).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("returns 201 and audits the owning module saved_report.create", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports",
        headers: authHeaders(adminToken(app)),
        payload: { name: "Active students", category: "students", filters: { status: "active" } },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ report: REPORT });
      expect(mockCreateSavedReportForOwner).toHaveBeenCalledWith("demo", {
        name: "Active students",
        category: "students",
        filters: { status: "active" },
        createdBy: "u-admin",
        createdByName: "Admin",
      });
      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u-admin",
          action: "students.saved_report.create",
          entityId: REPORT.id,
        }),
      );
    });

    it("denies 403 when the role lacks the module read permission", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports",
        headers: authHeaders(teacherToken(app)),
        payload: { name: "Due invoices", category: "finance", filters: { status: "due" } },
      });
      expect(response.statusCode).toBe(403);
      expect(mockCreateSavedReportForOwner).not.toHaveBeenCalled();
      expect(mockRecordAudit).not.toHaveBeenCalled();
    });

    it("returns 400 with the type/message envelope on an invalid body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports",
        headers: authHeaders(adminToken(app)),
        payload: { category: "students", filters: {} },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json() as { type: string; message: string };
      expect(typeof body.type).toBe("string");
      expect(typeof body.message).toBe("string");
      expect(body.type.length).toBeGreaterThan(0);
      expect(body.message.length).toBeGreaterThan(0);
      expect(mockCreateSavedReportForOwner).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("returns 200 success and audits the owning module saved_report.delete", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/saved-reports/report-1?category=students",
        headers: authHeaders(adminToken(app)),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
      expect(mockDeleteSavedReportByOwner).toHaveBeenCalledWith(
        "demo",
        "report-1",
        "students",
        "u-admin",
      );
      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u-admin",
          action: "students.saved_report.delete",
          entityId: "report-1",
        }),
      );
    });

    it("returns 404 not_found when the report is not owned or missing", async () => {
      mockDeleteSavedReportByOwner.mockResolvedValueOnce(false);
      const response = await app.inject({
        method: "DELETE",
        url: "/api/saved-reports/other-user-report?category=students",
        headers: authHeaders(adminToken(app)),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ type: "not_found", message: "Saved report not found" });
      expect(mockRecordAudit).not.toHaveBeenCalled();
    });

    it("denies 403 when the role lacks the module read permission", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/saved-reports/report-1?category=students",
        headers: authHeaders(viewerToken(app)),
      });
      expect(response.statusCode).toBe(403);
      expect(mockDeleteSavedReportByOwner).not.toHaveBeenCalled();
    });

    it("accepts the empty JSON object body the FE client sends", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/saved-reports/report-1?category=students",
        headers: authHeaders(adminToken(app)),
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });
  });

  describe("run", () => {
    it("returns 200 with the touched report and audits saved_report.run", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports/report-1/run?category=students",
        headers: authHeaders(adminToken(app)),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ report: REPORT });
      expect(mockTouchSavedReportRunByOwner).toHaveBeenCalledWith(
        "demo",
        "report-1",
        "students",
        "u-admin",
      );
      expect(mockRecordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u-admin",
          action: "students.saved_report.run",
          entityId: REPORT.id,
        }),
      );
    });

    it("returns 404 not_found when the report is not owned or missing", async () => {
      mockTouchSavedReportRunByOwner.mockResolvedValueOnce(null);
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports/other-user-report/run?category=students",
        headers: authHeaders(adminToken(app)),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ type: "not_found", message: "Saved report not found" });
      expect(mockRecordAudit).not.toHaveBeenCalled();
    });

    it("denies 403 when the role lacks the module read permission", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports/report-1/run?category=students",
        headers: authHeaders(viewerToken(app)),
      });
      expect(response.statusCode).toBe(403);
      expect(mockTouchSavedReportRunByOwner).not.toHaveBeenCalled();
    });

    it("accepts the empty JSON object body the FE client sends", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/saved-reports/report-1/run?category=students",
        headers: authHeaders(adminToken(app)),
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ report: REPORT });
    });
  });

  describe("category to module manifest mapping", () => {
    it.each([
      {
        category: "faculty",
        allowToken: (a: FastifyInstance) => teacherToken(a),
        allowUserId: "u-teacher",
        denyToken: (a: FastifyInstance) => viewerToken(a),
      },
      {
        category: "financial",
        allowToken: (a: FastifyInstance) => accountantToken(a),
        allowUserId: "u-accountant",
        denyToken: (a: FastifyInstance) => teacherToken(a),
      },
    ])(
      "gates $category on its owning module read permission",
      async ({ category, allowToken, allowUserId, denyToken }) => {
        const allowResponse = await app.inject({
          method: "GET",
          url: `/api/saved-reports?category=${category}`,
          headers: authHeaders(allowToken(app)),
        });
        expect(allowResponse.statusCode).toBe(200);
        expect(mockListSavedReportsByOwner).toHaveBeenCalledWith("demo", category, allowUserId);

        mockListSavedReportsByOwner.mockClear();
        const denyResponse = await app.inject({
          method: "GET",
          url: `/api/saved-reports?category=${category}`,
          headers: authHeaders(denyToken(app)),
        });
        expect(denyResponse.statusCode).toBe(403);
        expect(mockListSavedReportsByOwner).not.toHaveBeenCalled();
      },
    );

    it("gates messaging and users on the contacts read permission", async () => {
      // assistant_teacher holds messaging.read but NOT contacts.read — a 403
      // proves the categories gate on the contacts manifest, not messaging/users.
      for (const category of ["messaging", "users"] as const) {
        mockListSavedReportsByOwner.mockClear();
        const denyResponse = await app.inject({
          method: "GET",
          url: `/api/saved-reports?category=${category}`,
          headers: authHeaders(assistantTeacherToken(app)),
        });
        expect(denyResponse.statusCode).toBe(403);
        expect(mockListSavedReportsByOwner).not.toHaveBeenCalled();

        const allowResponse = await app.inject({
          method: "GET",
          url: `/api/saved-reports?category=${category}`,
          headers: authHeaders(adminToken(app)),
        });
        expect(allowResponse.statusCode).toBe(200);
      }
    });
  });
});
