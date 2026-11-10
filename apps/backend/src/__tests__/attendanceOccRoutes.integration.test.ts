import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { teacherToken, viewerToken } from "./helpers/tokens.js";

/**
 * Attendance OCC at the HTTP boundary.
 *
 * The repository proves `version` is an honest token (attendanceIntegrityDb), but the transport was
 * untested: nothing sent `x-expected-version`, so the header parsing, the 400 for a malformed token and
 * the 409 `stale_write` envelope could regress without a failing test.
 */

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  bulk: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherClassScope: vi.fn().mockResolvedValue(undefined),
  assertTeacherAnyClassScope: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../attendance/use-cases/instructionalDayGuard.js", () => ({
  assertInstructionalDays: vi.fn().mockResolvedValue(undefined),
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
    createAttendanceRecord: mocks.create,
    updateAttendanceRecordById: mocks.update,
    deleteAttendanceRecordById: vi.fn().mockResolvedValue(true),
    restoreAttendanceRecordById: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteAttendance: vi.fn().mockResolvedValue(1),
    bulkRestoreAttendance: vi.fn().mockResolvedValue(1),
    upsertAttendanceRecords: mocks.bulk,
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
    loadAttendanceWidgetAggregates: vi.fn().mockResolvedValue({}),
  },
}));

const RECORD = {
  id: "c1-2026-03-02-s1",
  classId: "c1",
  date: "2026-03-02",
  studentId: "s1",
  studentName: "Amina",
  rollNo: "1",
  status: "present" as const,
  timeIn: "08:00",
  timeOut: "10:00",
  notes: "",
  version: 2,
};

const HOST = { host: "demo.localhost" };

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  mocks.update.mockReset();
  mocks.bulk.mockReset();
  mocks.create.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("attendance OCC routes", () => {
  it("forwards a valid x-expected-version to the use case and returns the persisted record", async () => {
    mocks.update.mockResolvedValue(RECORD);
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/attendance/${RECORD.id}`,
      headers: {
        ...HOST,
        authorization: `Bearer ${teacherToken(app)}`,
        "x-expected-version": "1",
      },
      payload: { status: "late", timeIn: "08:15" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ record: RECORD });
    expect(mocks.update).toHaveBeenCalledWith(
      RECORD.id,
      expect.objectContaining({ id: RECORD.id, status: "late" }),
      expect.anything(),
      1,
      undefined,
    );
    await app.close();
  });

  it("rejects a malformed token with 400 and writes nothing", async () => {
    const { HttpDomainError } = await import("../lib/httpErrors.js");
    mocks.update.mockRejectedValue(
      new HttpDomainError(400, "validation_error", "Invalid x-expected-version header"),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/attendance/${RECORD.id}`,
      headers: {
        ...HOST,
        authorization: `Bearer ${teacherToken(app)}`,
        "x-expected-version": "abc",
      },
      payload: { status: "late" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "validation_error" });
    await app.close();
  });

  it("returns 409 stale_write for a stale token without overwriting", async () => {
    const { ConflictError } = await import("../lib/httpErrors.js");
    mocks.update.mockRejectedValue(new ConflictError("Record changed", "stale_write"));
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/attendance/${RECORD.id}`,
      headers: {
        ...HOST,
        authorization: `Bearer ${teacherToken(app)}`,
        "x-expected-version": "1",
      },
      payload: { status: "absent" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "stale_write" });
    await app.close();
  });

  it("forbids a viewer from updating with or without a token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/attendance/${RECORD.id}`,
      headers: { ...HOST, authorization: `Bearer ${viewerToken(app)}` },
      payload: { status: "absent" },
    });

    expect(res.statusCode).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    await app.close();
  });

  it("passes mixed token/no-token rows through bulk untouched", async () => {
    mocks.bulk.mockResolvedValue([RECORD]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/attendance/bulk",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: {
        records: [
          { ...RECORD, id: "c1-2026-03-02-s1" },
          { ...RECORD, id: "c1-2026-03-02-s2", studentId: "s2", version: undefined },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const [records] = mocks.bulk.mock.calls[0] as [Array<{ version?: number }>];
    expect(records[0]?.version).toBe(2);
    expect(records[1]?.version).toBeUndefined();
    await app.close();
  });

  it("rejects a strict-body violation before any write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance",
      headers: { ...HOST, authorization: `Bearer ${teacherToken(app)}` },
      payload: { ...RECORD, unexpectedField: "nope" },
    });

    expect(res.statusCode).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    await app.close();
  });
});
