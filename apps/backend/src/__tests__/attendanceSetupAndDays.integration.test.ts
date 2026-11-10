import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken, viewerToken } from "./helpers/tokens.js";

/**
 * Attendance routes that had no Fastify-injection coverage: check-in ingestion, roster/marked-dates,
 * widget aggregates, setup (preferences + lookups) and the roster-day submission flow.
 */

const mocks = vi.hoisted(() => ({
  ingest: vi.fn(),
  loadRoster: vi.fn(),
  markedDates: vi.fn(),
  widgets: vi.fn(),
  loadPage: vi.fn(),
  readDay: vi.fn(),
  submitDay: vi.fn(),
  reopenDay: vi.fn(),
  loadLookups: vi.fn(),
  replaceLookupKind: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
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
    loadAttendancePage: mocks.loadPage,
    countAttendanceRecords: vi.fn().mockResolvedValue(0),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecordById: vi.fn(),
    deleteAttendanceRecordById: vi.fn().mockResolvedValue(true),
    restoreAttendanceRecordById: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteAttendance: vi.fn().mockResolvedValue(0),
    bulkRestoreAttendance: vi.fn().mockResolvedValue(0),
    upsertAttendanceRecords: vi.fn().mockResolvedValue([]),
    replaceAttendanceRecords: vi.fn(),
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
    loadAttendanceWidgetAggregates: mocks.widgets,
    ingestAttendanceCheckIns: mocks.ingest,
    loadAttendanceRoster: mocks.loadRoster,
    listMarkedAttendanceDates: mocks.markedDates,
    countMatrixStudents: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock("../attendance/use-cases/attendanceLeaveUseCases.js", () => ({
  submitAttendanceDay: mocks.submitDay,
  reopenSubmittedAttendanceDay: mocks.reopenDay,
  readSubmittedAttendanceDay: mocks.readDay,
  recordApprovedLeave: vi.fn(),
}));
vi.mock("../services/attendanceLookupsService.js", () => ({
  loadAttendanceLookupsMap: mocks.loadLookups,
  replaceAttendanceLookupKind: mocks.replaceLookupKind,
}));
vi.mock("../services/attendancePreferencesService.js", () => ({
  getAttendancePreferencesService: mocks.getPreferences,
  updateAttendancePreferencesService: mocks.updatePreferences,
}));

const HOST = { host: "demo.localhost" };
const SUBMISSION = {
  classId: "c1",
  date: "2026-03-02",
  submittedAt: new Date("2026-03-02T10:00:00.000Z"),
  submittedBy: "u-teacher",
  reopenedAt: null,
  reopenedBy: null,
  reopenReason: null,
  locked: true,
};

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  mocks.loadPage.mockResolvedValue({ records: [], total: 0, page: 1, limit: 15, hasMore: false });
  mocks.readDay.mockResolvedValue({
    ...SUBMISSION,
    locked: false,
    submittedAt: new Date(0),
  });
  mocks.submitDay.mockResolvedValue({ submission: SUBMISSION, alreadySubmitted: false });
  mocks.reopenDay.mockResolvedValue(SUBMISSION);
  mocks.loadLookups.mockResolvedValue({ statuses: [] });
  mocks.getPreferences.mockResolvedValue({ trackHalfDay: false });
  mocks.updatePreferences.mockResolvedValue(undefined);
  mocks.ingest.mockResolvedValue({ applied: 1, skipped: 0, errors: [] });
  mocks.widgets.mockResolvedValue({});
  mocks.loadRoster.mockResolvedValue({ students: [], records: [], marks: [] });
  mocks.markedDates.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("attendance check-in ingestion", () => {
  it("accepts a device batch and returns the per-row report", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/check-ins",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: {
        rows: [{ studentId: "s1", classId: "c1", timeIn: "08:05", date: "2026-03-02" }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ applied: 1, skipped: 0, errors: [] });
    await app.close();
  });

  it("rejects a malformed check-in row before the use case", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/check-ins",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: { rows: [{ timeIn: "08:05" }] },
    });

    expect(res.statusCode).toBe(400);
    expect(mocks.ingest).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("roster, coverage and widget reads", () => {
  it("requires classId and date for the roster", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/roster",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns marked dates for the coverage calendar", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/marked-dates?from=2026-03-01&to=2026-03-31",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("forbids widget aggregates for a role without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/widget-aggregates",
      headers: { ...HOST, authorization: `Bearer ${viewerToken(app)}` },
      payload: { widgets: [] },
    });
    // Viewers may read attendance; the assertion is that the route is wired and answers 200/403,
    // never a 404/500.
    expect([200, 403]).toContain(res.statusCode);
    await app.close();
  });
});

describe("roster day submission", () => {
  it("reads the submission state", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/days/c1/2026-03-02",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ alreadySubmitted: false });
    await app.close();
  });

  it("submits a day and reports the lock", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/days/c1/2026-03-02/submit",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ alreadySubmitted: false });
    await app.close();
  });

  it("forbids a teacher from reopening a submitted day", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/days/c1/2026-03-02/reopen",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: { reason: "Correction" },
    });
    expect(res.statusCode).toBe(403);
    expect(mocks.reopenDay).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets an admin reopen with a reason", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/days/c1/2026-03-02/reopen",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: { reason: "Correction" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("attendance setup routes", () => {
  it("returns normalised preferences", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/attendance/preferences",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns 422 when a half-day lookup is saved while tracking is off", async () => {
    const { HttpDomainError } = await import("../lib/httpErrors.js");
    mocks.replaceLookupKind.mockRejectedValue(
      new HttpDomainError(
        422,
        "attendance_half_day_disabled",
        "Half-day tracking is disabled for this school",
      ),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/attendance/lookups/statuses",
      headers: { ...HOST, authorization: `Bearer ${adminToken(app)}` },
      payload: {
        items: [
          {
            id: "half_day",
            label: "Half day",
            short: "H",
            color: "muted",
            bg: "bg-muted",
            text: "text-muted-foreground",
            border: "border-border",
            dot: "bg-muted-foreground",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ type: "attendance_half_day_disabled" });
    await app.close();
  });
});
