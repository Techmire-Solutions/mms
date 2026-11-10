import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken, viewerToken } from "./helpers/tokens.js";

/**
 * Attendance admin routes that had no injection coverage: excuse list/review/cancel, absence alerts,
 * bulk restore, lookup read and field config.
 */

const mocks = vi.hoisted(() => ({
  listExcuses: vi.fn(),
  reviewExcuse: vi.fn(),
  cancelExcuse: vi.fn(),
  listAlerts: vi.fn(),
  resolveAlert: vi.fn(),
  bulkRestore: vi.fn(),
  loadLookups: vi.fn(),
  fieldConfig: vi.fn(),
  enqueueJob: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherClassScope: vi.fn().mockResolvedValue(undefined),
  assertTeacherAnyClassScope: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../attendance/use-cases/instructionalDayGuard.js", () => ({
  assertInstructionalDays: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, fn: () => unknown) => fn(),
  withTenantRead: (_tenant: string, fn: () => unknown) => fn(),
}));
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
    getWorkspaceBySubdomain: vi.fn(async (subdomain: string) =>
      subdomain === "demo"
        ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
        : null,
    ),
  };
});
vi.mock("../attendance/use-cases/attendanceUseCases.js", () => ({
  attendanceUseCases: {
    loadAttendanceRecords: vi.fn().mockResolvedValue([]),
    loadAttendancePage: vi.fn().mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),
    countAttendanceRecords: vi.fn().mockResolvedValue(0),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecordById: vi.fn(),
    deleteAttendanceRecordById: vi.fn().mockResolvedValue(true),
    restoreAttendanceRecordById: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteAttendance: vi.fn().mockResolvedValue(0),
    bulkRestoreAttendance: mocks.bulkRestore,
    upsertAttendanceRecords: vi.fn().mockResolvedValue([]),
    replaceAttendanceRecords: vi.fn(),
    loadAttendanceRoster: vi.fn().mockResolvedValue({ students: [], records: [], marks: [] }),
    listMarkedAttendanceDates: vi.fn().mockResolvedValue([]),
    countMatrixStudents: vi.fn().mockResolvedValue(0),
    loadAttendanceReportAggregates: vi.fn().mockResolvedValue({
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
    }),
    loadAttendanceCommandMetrics: vi.fn().mockResolvedValue({}),
    loadAttendanceWidgetAggregates: vi.fn().mockResolvedValue({}),
    ingestAttendanceCheckIns: vi.fn().mockResolvedValue({ applied: 0, skipped: 0, errors: [] }),
  },
}));
vi.mock("../attendance/use-cases/attendanceExcuseUseCases.js", () => ({
  attendanceExcuseUseCases: {
    listExcuses: mocks.listExcuses,
    submitExcuse: vi.fn(),
    reviewExcuse: mocks.reviewExcuse,
    cancelExcuse: mocks.cancelExcuse,
  },
}));
vi.mock("../attendance/use-cases/attendanceEscalationUseCases.js", () => ({
  attendanceEscalationUseCases: {
    listAlerts: mocks.listAlerts,
    resolveAlert: mocks.resolveAlert,
    scan: vi.fn(),
  },
}));
vi.mock("../services/attendanceLookupsService.js", () => ({
  loadAttendanceLookupsMap: mocks.loadLookups,
  replaceAttendanceLookupKind: vi.fn(),
}));
vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobWorkerService.js")>();
  return {
    ...actual,
    enqueueBackgroundJob: mocks.enqueueJob,
    getUserBackgroundJob: mocks.getJob,
  };
});
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/attendanceConfigService.js", () => ({
  getAttendanceFieldConfigService: mocks.fieldConfig,
  updateAttendanceFieldConfigService: vi.fn(),
}));

const HOST = { host: "demo.localhost" };
const LEAVE = {
  id: "leave-1",
  studentId: "s1",
  fromDate: "2026-03-02",
  toDate: "2026-03-03",
  reason: "Fever",
  status: "pending",
  leaveType: "medical",
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  attachmentUrl: null,
  requestedBy: "u-teacher",
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  mocks.listExcuses.mockResolvedValue([LEAVE]);
  mocks.reviewExcuse.mockResolvedValue({ ...LEAVE, status: "approved" });
  mocks.cancelExcuse.mockResolvedValue({ ...LEAVE, status: "cancelled" });
  mocks.listAlerts.mockResolvedValue([]);
  mocks.resolveAlert.mockResolvedValue({ id: "alert-1", resolved: true });
  mocks.bulkRestore.mockResolvedValue(2);
  mocks.loadLookups.mockResolvedValue({ statuses: [] });
  mocks.fieldConfig.mockResolvedValue(null);
  mocks.getJob.mockResolvedValue(null);
  mocks.enqueueJob.mockImplementation(async (tenant: string, user: string, job: unknown) => ({
    ...(job as Record<string, unknown>),
    id: "job-scan-1",
    tenant,
    user,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("attendance leaves", () => {
  it("lists excuses for a reader", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/leaves",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ leaves: [expect.objectContaining({ id: "leave-1" })] });
    await app.close();
  });

  it("approves a leave and returns the decided row", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/leaves/leave-1/review",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: { decision: "approve", note: "Certificate verified" },
    });
    expect(res.statusCode).toBe(200);
    expect(mocks.reviewExcuse).toHaveBeenCalledWith(
      "leave-1",
      expect.objectContaining({ decision: "approve" }),
      expect.anything(),
    );
    await app.close();
  });

  it("cancels an approved leave", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/leaves/leave-1/cancel",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: { reason: "Returned to class" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("refuses a viewer without write access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/leaves/leave-1/cancel",
      headers: { ...HOST, authorization: `Bearer ${viewerToken(app)}` },
      payload: { reason: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(mocks.cancelExcuse).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("attendance absence alerts", () => {
  it("lists alerts for a reader", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/absence-alerts",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("resolves an alert", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/absence-alerts/alert-1/resolve",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: { status: "resolved", note: "Guardian contacted" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("attendance background routes", () => {
  it("queues a chronic-absence scan and returns the job envelope", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/absence-alerts/scan",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ job: expect.objectContaining({ id: "job-scan-1" }) });
    await app.close();
  });

  it("queues a matrix export for a valid range", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/export/matrix",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: { classId: "c1", dateFrom: "2026-03-01", dateTo: "2026-03-05", format: "csv" },
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it("rejects an inverted matrix range before queueing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/export/matrix",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: { classId: "c1", dateFrom: "2026-03-05", dateTo: "2026-03-01", format: "csv" },
    });
    expect(res.statusCode).toBe(400);
    expect(mocks.enqueueJob).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("attendance admin reads and bulk restore", () => {
  it("restores archived rows in bulk", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/bulk-restore",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: { ids: ["att-1", "att-2"] },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns lookups and field config for setup", async () => {
    const app = await buildApp();
    const [lookups, config] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/attendance/lookups",
        headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      }),
      app.inject({
        method: "GET",
        url: "/api/attendance/field-config",
        headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      }),
    ]);
    expect(lookups.statusCode).toBe(200);
    expect(config.statusCode).toBe(200);
    await app.close();
  });
});
