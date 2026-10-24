import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { accountantToken, adminToken, viewerToken } from "./helpers/tokens.js";

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

const mockLoadEnrollmentById = vi.fn();
const mockLoadEnrollmentsPage = vi.fn();
const mockLoadEnrollmentsCommandMetrics = vi.fn();
const mockLoadEnrollmentsReportAggregates = vi.fn();
const mockLoadEnrollmentsWidgetAggregates = vi.fn();
const mockEnqueueBackgroundJob = vi.fn();
const mockGetUserBackgroundJob = vi.fn();
const mockRecordAudit = vi.fn();

vi.mock("../enrollments/use-cases/enrollmentsUseCases.js", () => ({
  enrollmentsUseCases: {
    loadEnrollmentById: (...args: unknown[]) => mockLoadEnrollmentById(...args),
    loadEnrollmentsPage: (...args: unknown[]) => mockLoadEnrollmentsPage(...args),
    loadEnrollmentsCommandMetrics: (...args: unknown[]) =>
      mockLoadEnrollmentsCommandMetrics(...args),
    loadEnrollmentsReportAggregates: (...args: unknown[]) =>
      mockLoadEnrollmentsReportAggregates(...args),
    loadEnrollmentsWidgetAggregates: (...args: unknown[]) =>
      mockLoadEnrollmentsWidgetAggregates(...args),
    countEnrollments: vi.fn().mockResolvedValue(0),
    createEnrollment: vi.fn(),
    updateEnrollmentById: vi.fn(),
    deleteEnrollmentById: vi.fn(),
    restoreEnrollmentById: vi.fn(),
    bulkSoftDeleteEnrollments: vi.fn(),
    bulkRestoreEnrollments: vi.fn(),
    loadEnrollmentsByIds: vi.fn().mockResolvedValue([]),
  },
}));

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
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobWorkerService.js")>();
  return {
    ...actual,
    enqueueBackgroundJob: (...args: unknown[]) => mockEnqueueBackgroundJob(...args),
    getUserBackgroundJob: (...args: unknown[]) => mockGetUserBackgroundJob(...args),
  };
});

describe("enrollments REST routes integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadEnrollmentById.mockReset().mockResolvedValue(null);
    mockLoadEnrollmentsPage.mockReset().mockResolvedValue({
      enrollments: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    mockLoadEnrollmentsCommandMetrics.mockReset().mockResolvedValue({
      total: 0,
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      completed: 0,
      revenue: 0,
      newThisPeriod: 0,
    });
    mockLoadEnrollmentsReportAggregates.mockReset().mockResolvedValue({
      cumulativeTrends: [],
      statusCounts: { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total: 0 },
      fees: { due: 0, paid: 0 },
      bySession: [],
    });
    mockLoadEnrollmentsWidgetAggregates.mockReset().mockResolvedValue({
      w1: { value: 5, totalCount: 5, chartData: [{ name: "confirmed", value: 3 }] },
    });
    mockEnqueueBackgroundJob.mockReset().mockResolvedValue({
      id: "job-enr-export",
      status: "queued",
      moduleId: "enrollments",
      kind: "export",
    });
    mockGetUserBackgroundJob.mockReset();
    mockRecordAudit.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/enrollments requires auth header", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/enrollments returns 200 for authorized admin", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app, { name: "Admin User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      enrollments: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    await app.close();
  });

  it("GET /api/enrollments/:id returns enrollment for authorized user", async () => {
    const mockEnrollment = {
      id: "enr-1",
      studentId: "stu-1",
      studentName: "Ali",
      sessionId: "ses-1",
      sessionName: "Hifz",
      status: "confirmed",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockLoadEnrollmentById.mockResolvedValue(mockEnrollment);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/enr-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app, { name: "Admin User" })}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(mockEnrollment);
    expect(mockLoadEnrollmentById).toHaveBeenCalledWith("enr-1", false);
    await app.close();
  });

  it("GET /api/enrollments/:id returns 404 when enrollment does not exist", async () => {
    mockLoadEnrollmentById.mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/enr-nonexistent",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "not_found" });
    await app.close();
  });

  it("GET /api/enrollments/:id returns 403 when user lacks read permission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/enr-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadEnrollmentById).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/enrollments/:id with includeDeleted=true requires delete permission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/enr-1?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadEnrollmentById).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/enrollments forwards session and class roster filters", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments?page=1&limit=100&sessionId=ses-1&classId=cls-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app, { name: "Admin User" })}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockLoadEnrollmentsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 100,
        sessionId: "ses-1",
        classId: "cls-1",
      }),
    );
    await app.close();
  });

  it("GET /api/enrollments/report-aggregates loads cumulative trends for authorized roles", async () => {
    // Cumulative series (not monthly-new [2,1,1]).
    mockLoadEnrollmentsReportAggregates.mockResolvedValue({
      cumulativeTrends: [
        { monthKey: "2026-01", students: 2 },
        { monthKey: "2026-02", students: 3 },
        { monthKey: "2026-03", students: 4 },
      ],
      statusCounts: { pending: 1, confirmed: 2, cancelled: 0, completed: 1, total: 4 },
      fees: { due: 300, paid: 150 },
      bySession: [{ sessionId: "ses-1", name: "Hifz", count: 4, revenue: 300 }],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      cumulativeTrends: Array<{ monthKey: string; students: number }>;
      statusCounts: { total: number; confirmed: number };
      fees: { due: number; paid: number };
      bySession: Array<{ sessionId: string; name: string; count: number; revenue: number }>;
    };
    expect(body.cumulativeTrends).toEqual([
      { monthKey: "2026-01", students: 2 },
      { monthKey: "2026-02", students: 3 },
      { monthKey: "2026-03", students: 4 },
    ]);
    expect(body.cumulativeTrends[1]!.students).toBeGreaterThan(body.cumulativeTrends[0]!.students);
    expect(body.statusCounts).toEqual({
      pending: 1,
      confirmed: 2,
      cancelled: 0,
      completed: 1,
      total: 4,
    });
    expect(body.fees).toEqual({ due: 300, paid: 150 });
    expect(body.bySession).toEqual([{ sessionId: "ses-1", name: "Hifz", count: 4, revenue: 300 }]);
    expect(mockLoadEnrollmentsReportAggregates).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/enrollments/report-aggregates forwards comparison query params", async () => {
    mockLoadEnrollmentsReportAggregates.mockResolvedValue({
      cumulativeTrends: [],
      statusCounts: { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total: 0 },
      fees: { due: 0, paid: 0 },
      bySession: [],
      comparison: {
        sessions: [{ sessionId: "s1", enrollmentCount: 2, studentIds: ["stu-1"] }],
        monthly: {
          a: [{ monthKey: "2026-01", count: 2 }],
          b: [{ monthKey: "2026-02", count: 1 }],
        },
      },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/report-aggregates?sessionIds=s1,s2&rangeAFrom=2026-01-01&rangeATo=2026-03-31&rangeBFrom=2026-04-01&rangeBTo=2026-06-30",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().comparison?.sessions?.[0]?.enrollmentCount).toBe(2);
    expect(mockLoadEnrollmentsReportAggregates).toHaveBeenCalledWith({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
      rangeBFrom: "2026-04-01",
      rangeBTo: "2026-06-30",
    });
    await app.close();
  });

  it("GET /api/enrollments/report-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadEnrollmentsReportAggregates).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/enrollments/metrics uses SQL loadMetricsFn", async () => {
    mockLoadEnrollmentsCommandMetrics.mockResolvedValue({
      total: 4,
      confirmed: 2,
      pending: 1,
      cancelled: 1,
      completed: 0,
      revenue: 200,
      newThisPeriod: 1,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 4,
        confirmed: 2,
        pending: 1,
        cancelled: 1,
        completed: 0,
        revenue: 200,
        newThisPeriod: 1,
      },
    });
    expect(mockLoadEnrollmentsCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/enrollments/widget-aggregates loads aggregates for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/widget-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        widgets: [{ id: "w1", operation: "count", xAxisField: "status" }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: {
        w1: { value: 5, totalCount: 5, chartData: [{ name: "confirmed", value: 3 }] },
      },
    });
    expect(mockLoadEnrollmentsWidgetAggregates).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "w1", operation: "count", xAxisField: "status" })],
      expect.anything(),
    );
    await app.close();
  });

  it("POST /api/enrollments/widget-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/widget-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        widgets: [{ id: "w1", operation: "count" }],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadEnrollmentsWidgetAggregates).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/enrollments/export/csv queues and audits exports on the server", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        label: "Enrollments CSV",
        columns: [{ id: "studentName", label: "Student" }],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({
        moduleId: "enrollments",
        kind: "export",
        label: "Enrollments CSV",
      }),
      expect.objectContaining({
        columns: [{ id: "studentName", label: "Student" }],
        label: "Enrollments CSV",
        viewerRole: "admin",
        allowDeleted: true,
      }),
    );
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "enrollment.export.queue",
        entityId: expect.any(String),
      }),
    );
    await app.close();
  });

  it("POST /api/enrollments/export/csv accepts selection ids", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        label: "Selection CSV",
        columns: [{ id: "studentName", label: "Student" }],
        ids: ["enr-1", "enr-2"],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({ kind: "export" }),
      expect.objectContaining({
        query: expect.objectContaining({ includeIds: ["enr-1", "enr-2"] }),
      }),
    );
    await app.close();
  });

  it("POST /api/enrollments/export/csv returns 403 without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: { label: "Denied CSV" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockEnqueueBackgroundJob).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/enrollments/export/csv strips includeDeleted without enrollments.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${accountantToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        label: "Trash CSV",
        query: { includeDeleted: "true", search: "ali" },
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({ kind: "export" }),
      expect.objectContaining({
        allowDeleted: false,
        query: { search: "ali" },
      }),
    );
    await app.close();
  });
});
