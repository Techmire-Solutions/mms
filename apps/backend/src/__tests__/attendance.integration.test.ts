import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const mockLoadAttendanceRecords = vi.fn();
const mockLoadAttendancePage = vi.fn();
const mockCreateAttendanceRecord = vi.fn();
const mockUpsertAttendanceRecords = vi.fn();
const mockDeleteAttendanceRecordById = vi.fn();
const mockRestoreAttendanceRecordById = vi.fn();
const mockBulkSoftDeleteAttendance = vi.fn();
const mockBulkRestoreAttendance = vi.fn();
const mockLoadAttendanceReportAggregates = vi.fn();
const mockLoadAttendanceCommandMetrics = vi.fn();

vi.mock("../attendance/use-cases/attendanceUseCases.js", () => ({
  attendanceUseCases: {
    loadAttendanceRecords: (...args: unknown[]) => mockLoadAttendanceRecords(...args),
    loadAttendancePage: (...args: unknown[]) => mockLoadAttendancePage(...args),
    countAttendanceRecords: vi.fn().mockResolvedValue(0),
    createAttendanceRecord: (...args: unknown[]) => mockCreateAttendanceRecord(...args),
    updateAttendanceRecordById: vi.fn(),
    deleteAttendanceRecordById: (...args: unknown[]) => mockDeleteAttendanceRecordById(...args),
    restoreAttendanceRecordById: (...args: unknown[]) => mockRestoreAttendanceRecordById(...args),
    bulkSoftDeleteAttendance: (...args: unknown[]) => mockBulkSoftDeleteAttendance(...args),
    bulkRestoreAttendance: (...args: unknown[]) => mockBulkRestoreAttendance(...args),
    upsertAttendanceRecords: (...args: unknown[]) => mockUpsertAttendanceRecords(...args),
    replaceAttendanceRecords: vi.fn(),
    loadAttendanceReportAggregates: (...args: unknown[]) =>
      mockLoadAttendanceReportAggregates(...args),
    loadAttendanceCommandMetrics: (...args: unknown[]) => mockLoadAttendanceCommandMetrics(...args),
    loadAttendanceWidgetAggregates: vi.fn().mockResolvedValue({}),
  },
}));

const attendanceRecord = {
  id: "c1-2026-07-27-s1",
  classId: "c1",
  date: "2026-07-27",
  studentId: "s1",
  studentName: "Jane Doe",
  rollNo: "0001",
  status: "present" as const,
  timeIn: "07:00",
  timeOut: "08:30",
  notes: "",
};

describe("attendance REST routes integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadAttendanceRecords.mockReset().mockResolvedValue([]);
    mockLoadAttendancePage.mockReset().mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    mockCreateAttendanceRecord.mockReset();
    mockUpsertAttendanceRecords.mockReset();
    mockDeleteAttendanceRecordById.mockReset();
    mockRestoreAttendanceRecordById.mockReset();
    mockBulkSoftDeleteAttendance.mockReset();
    mockBulkRestoreAttendance.mockReset();
    mockLoadAttendanceReportAggregates.mockReset().mockResolvedValue({
      overview: {
        overallRate: 0,
        totalRecords: 0,
        lowAttendanceCount: 0,
        classRates: [],
        monthlyTrend: [],
        studentRates: [],
        topPerformers: [],
        statusCounts: [],
      },
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/attendance requires authentication", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/attendance returns 200 and list for authenticated teacher", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      records: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    await app.close();
  });

  it("GET /api/attendance forwards session and faculty filters", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance?page=2&sessionId=session-1&facultyId=teacher-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockLoadAttendancePage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        sessionId: "session-1",
        facultyId: "teacher-1",
      }),
    );
    await app.close();
  });

  it("does not leak internal error messages in 500 list responses", async () => {
    mockLoadAttendancePage.mockRejectedValueOnce(
      new Error("SENSITIVE_INTERNAL_DETAILS: db password=secret"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      type: "database_error",
      message: "Failed to list attendance",
    });
    expect(JSON.stringify(res.json())).not.toContain("SENSITIVE_INTERNAL_DETAILS");
    await app.close();
  });

  it("does not leak internal error messages in 500 create responses", async () => {
    mockCreateAttendanceRecord.mockRejectedValueOnce(
      new Error("SENSITIVE_INTERNAL_DETAILS: db password=secret"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: attendanceRecord,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      type: "database_error",
      message: "Failed to create attendance",
    });
    expect(JSON.stringify(res.json())).not.toContain("SENSITIVE_INTERNAL_DETAILS");
    await app.close();
  });

  it("PUT /api/attendance/bulk upserts only supplied records", async () => {
    mockUpsertAttendanceRecords.mockResolvedValueOnce([attendanceRecord]);

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/attendance/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: {
        records: [attendanceRecord],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockUpsertAttendanceRecords).toHaveBeenCalledWith([attendanceRecord]);
    expect(res.json()).toEqual({ records: [attendanceRecord] });
    await app.close();
  });

  it("teacher cannot delete attendance records", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/attendance/${attendanceRecord.id}`,
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockDeleteAttendanceRecordById).not.toHaveBeenCalled();
    await app.close();
  });

  it("admin can bulk soft-delete attendance records", async () => {
    mockBulkSoftDeleteAttendance.mockResolvedValueOnce({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: [attendanceRecord.id] },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkSoftDeleteAttendance).toHaveBeenCalledWith(
      [attendanceRecord.id],
      "u-admin",
      undefined,
    );
    await app.close();
  });

  it("admin can restore an archived attendance record", async () => {
    mockRestoreAttendanceRecordById.mockResolvedValueOnce(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/attendance/${attendanceRecord.id}/restore`,
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreAttendanceRecordById).toHaveBeenCalledWith(attendanceRecord.id, "u-admin");
    await app.close();
  });

  it("includeDeleted returns deleted-only attendance for admins", async () => {
    mockLoadAttendancePage.mockResolvedValueOnce({
      records: [{ ...attendanceRecord, deletedAt: "2026-07-27T12:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadAttendancePage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    expect(typeof res.json().records[0].deletedAt).toBe("string");
    expect(res.json().records[0].deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });

  it("forbids includeDeleted for roles without delete access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadAttendancePage).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/attendance/report-aggregates loads comparison for authorized roles", async () => {
    mockLoadAttendanceReportAggregates.mockResolvedValueOnce({
      overview: {
        overallRate: 0,
        totalRecords: 0,
        lowAttendanceCount: 0,
        classRates: [],
        monthlyTrend: [],
        studentRates: [],
        topPerformers: [],
        statusCounts: [],
      },
      comparison: {
        sessions: [{ sessionId: "s1", attendancePct: 80 }],
        monthly: {
          a: [{ monthKey: "2026-01", presentCount: 8, total: 10 }],
          b: [{ monthKey: "2026-04", presentCount: 9, total: 12 }],
        },
      },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/report-aggregates?sessionIds=s1,s2&rangeAFrom=2026-01-01&rangeATo=2026-03-31&rangeBFrom=2026-04-01&rangeBTo=2026-06-30",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadAttendanceReportAggregates).toHaveBeenCalledWith({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
      rangeBFrom: "2026-04-01",
      rangeBTo: "2026-06-30",
    });
    expect(res.json().comparison?.sessions?.[0]?.attendancePct).toBe(80);
    await app.close();
  });

  it("GET /api/attendance/report-aggregates forwards the analytics class filter", async () => {
    mockLoadAttendanceReportAggregates.mockResolvedValueOnce({
      overview: {
        overallRate: 75,
        totalRecords: 4,
        lowAttendanceCount: 1,
        classRates: [],
        monthlyTrend: [],
        studentRates: [],
        topPerformers: [],
        statusCounts: [],
      },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/report-aggregates?classId=class-2",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadAttendanceReportAggregates).toHaveBeenCalledWith({ classId: "class-2" });
    expect(res.json().overview.overallRate).toBe(75);
    await app.close();
  });

  it("GET /api/attendance/report-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadAttendanceReportAggregates).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("attendance metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadAttendanceCommandMetrics.mockReset().mockResolvedValue({
      total: 10,
      selectedDatePresent: 4,
      selectedDateAbsent: 1,
      selectedDateLate: 1,
      selectedDateExcused: 0,
      periodTotal: 8,
      selectedDatePresentRate: 83,
      priorDatePresentRate: 75,
      overallPresentRate: 80,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/attendance/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/metrics?date=2026-08-18",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 10,
        selectedDatePresent: 4,
        selectedDateAbsent: 1,
        selectedDateLate: 1,
        selectedDateExcused: 0,
        periodTotal: 8,
        selectedDatePresentRate: 83,
        priorDatePresentRate: 75,
        overallPresentRate: 80,
      },
    });
    expect(mockLoadAttendanceCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/attendance/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadAttendanceCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});
