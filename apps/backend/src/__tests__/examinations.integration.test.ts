import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import {
  adminToken,
  assistantTeacherToken,
  guardianToken,
  signTenantToken,
  teacherToken,
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

const mockLoadExams = vi.fn();
const mockLoadExamsPage = vi.fn();

// The bulk results route composes the real eligibility/scope gate (DB-backed). Stub it so the
// route-level contract test can assert the locked-write mapping without a database; individual
// tests replace the implementation to exercise the structured-error envelope.
const mockAuthorizeAndStamp = vi.hoisted(() =>
  vi.fn(async (user: { id: string }, results: Array<Record<string, unknown>>) =>
    results.map((result) => ({ ...result, markedBy: user.id })),
  ),
);
vi.mock("../examinations/use-cases/examResultsSubmission.js", () => ({
  authorizeAndStampExamResults: mockAuthorizeAndStamp,
}));

// Gate/lifecycle/setup routes are DB-backed; the route contract (validation, permissions, error
// envelope) is what this file pins, so their use cases are stubbed.
const mockGetEligibilityView = vi.hoisted(() => vi.fn());
const mockConfigureGate = vi.hoisted(() => vi.fn());
const mockGrantOverride = vi.hoisted(() => vi.fn());
const mockRevokeOverride = vi.hoisted(() => vi.fn());
vi.mock("../examinations/use-cases/examEligibilityGate.js", () => ({
  getExamEligibilityView: (...args: unknown[]) => mockGetEligibilityView(...args),
  configureExamAttendanceGate: (...args: unknown[]) => mockConfigureGate(...args),
  grantExamEligibilityOverride: (...args: unknown[]) => mockGrantOverride(...args),
  revokeExamEligibilityOverride: (...args: unknown[]) => mockRevokeOverride(...args),
}));

const mockPublishExamResults = vi.hoisted(() => vi.fn());
const mockUnpublishExamResults = vi.hoisted(() => vi.fn());
vi.mock("../examinations/use-cases/examLifecycleUseCases.js", () => ({
  publishExamResults: (...args: unknown[]) => mockPublishExamResults(...args),
  unpublishExamResults: (...args: unknown[]) => mockUnpublishExamResults(...args),
}));

vi.mock("../services/examinationConfigService.js", () => ({
  getExaminationFieldConfigService: vi.fn().mockResolvedValue({ tabs: [] }),
  updateExaminationFieldConfigService: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/examinationPreferencesService.js", () => ({
  getExaminationPreferencesService: vi.fn().mockResolvedValue({ passMark: "50" }),
  updateExaminationPreferencesService: vi.fn().mockResolvedValue(undefined),
}));
const mockLoadExaminationsCommandMetrics = vi.fn();

vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: {
    loadExams: (...args: unknown[]) => mockLoadExams(...args),
    loadExamsPage: (...args: unknown[]) => mockLoadExamsPage(...args),
    upsertExams: vi.fn().mockResolvedValue([]),
    replaceExams: vi.fn(),
    loadExamResults: vi.fn().mockResolvedValue([]),
    loadExamResultsPage: vi.fn().mockResolvedValue({ results: [], hasMore: false }),
    loadExamById: vi.fn().mockResolvedValue(null),
    upsertExamResults: vi.fn().mockResolvedValue([]),
    replaceExamResults: vi.fn(),
    deleteExamById: vi.fn(),
    restoreExamById: vi.fn(),
    bulkSoftDeleteExams: vi.fn(),
    bulkRestoreExams: vi.fn(),
    loadExaminationsCommandMetrics: (...args: unknown[]) =>
      mockLoadExaminationsCommandMetrics(...args),
    loadExaminationsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadExaminationsReportAggregates: vi.fn().mockResolvedValue({}),
  },
}));

describe("examinations REST routes integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadExams.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/examinations/exams requires auth header", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/examinations/exams returns 200 for authorized teacher", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app, { name: "Teacher User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ exams: [] });
    await app.close();
  });
});

describe("examinations exams pagination", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadExamsPage.mockReset().mockResolvedValue({
      exams: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/examinations/exams returns paginated shape and forwards filters", async () => {
    mockLoadExamsPage.mockResolvedValueOnce({
      exams: [{ id: "e-1", name: "Midterm", subject: "Quran", status: "upcoming" }],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams?page=1&limit=10&search=mid&status=upcoming",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      exams: [{ id: "e-1", name: "Midterm", subject: "Quran", status: "upcoming" }],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    expect(mockLoadExamsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        search: "mid",
        status: "upcoming",
        includeDeleted: false,
      }),
    );
    await app.close();
  });

  it("includeDeleted=true forwards deleted-only request for admins", async () => {
    mockLoadExamsPage.mockResolvedValueOnce({
      exams: [{ id: "e-2", name: "Old Exam", deletedAt: "2026-07-27T12:00:00.000Z" }],
      total: 1,
      page: 1,
      limit: 12,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadExamsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    expect(typeof res.json().exams[0]?.deletedAt).toBe("string");
    expect(res.json().exams[0]?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });

  it("forbids includeDeleted for roles without delete access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${assistantTeacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadExamsPage).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("examinations metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadExaminationsCommandMetrics.mockReset().mockResolvedValue({
      total: 3,
      upcoming: 1,
      ongoing: 1,
      completed: 1,
      scheduled: 0,
      cancelled: 0,
      totalResults: 5,
      examsWithResults: 2,
      passRate: 80,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/examinations/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app, { name: "Teacher User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 3,
        upcoming: 1,
        ongoing: 1,
        completed: 1,
        scheduled: 0,
        cancelled: 0,
        totalResults: 5,
        examsWithResults: 2,
        passRate: 80,
      },
    });
    expect(mockLoadExaminationsCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/examinations/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${guardianToken(app, {
          id: "u-unauthorized",
          email: "unauth@test.com",
          name: "Unauthorized",
        })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadExaminationsCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("examinations marks privacy and mutation authority", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("strips internal mark fields for a read-only auditor", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExamResultsPage: ReturnType<typeof vi.fn>;
    };
    useCases.loadExamResultsPage.mockResolvedValueOnce({
      results: [
        {
          id: "r-1",
          examId: "e-1",
          studentId: "s-1",
          marksObtained: 80,
          version: 4,
          markedBy: "u-teacher",
          graceMarks: 2,
          moderationReason: "internal note",
          moderatedBy: "u-admin",
        },
      ],
      hasMore: false,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/results",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "auditor" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { results: Array<Record<string, unknown>> };
    expect(body.results[0]).toEqual({
      id: "r-1",
      examId: "e-1",
      studentId: "s-1",
      marksObtained: 80,
      graceMarks: 2,
    });
    expect(body.results[0]).not.toHaveProperty("markedBy");
    expect(body.results[0]).not.toHaveProperty("version");
    expect(body.results[0]).not.toHaveProperty("moderationReason");
    await app.close();
  });

  it("does not let a teacher moderate marks", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/results/s-1/moderation",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: { graceMarks: 2, reason: "borderline script" },
    });
    // The module gate requires `examinations.delete` for moderation.
    expect(res.statusCode, res.body).toBe(403);
    await app.close();
  });

  it("returns 404 for eligibility of an unknown exam", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams/does-not-exist/eligibility",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("examinations publication scope and tenant binding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function resultsMock() {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExamResultsPage: ReturnType<typeof vi.fn>;
    };
    useCases.loadExamResultsPage.mockResolvedValue({ results: [], hasMore: false });
    useCases.loadExamResultsPage.mockClear();
    return useCases.loadExamResultsPage;
  }

  it("asks for published-only marks for a read-only audience", async () => {
    const loadPage = await resultsMock();
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/results",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "auditor" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(loadPage).toHaveBeenCalledWith(expect.objectContaining({ publishedOnly: true }));
    await app.close();
  });

  it("keeps the full marks scope for a writer", async () => {
    const loadPage = await resultsMock();
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/results",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(loadPage).toHaveBeenCalledWith(expect.objectContaining({ publishedOnly: false }));
    await app.close();
  });

  it("rejects a token issued for a different workspace than the request host", async () => {
    // Tenant binding failure is a 403 (authenticated but not for this workspace), not a 401.
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", workspaceSubdomain: "other" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("examinations report aggregates endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the always-on analytics slice to a reader", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExaminationsReportAggregates: ReturnType<typeof vi.fn>;
    };
    useCases.loadExaminationsReportAggregates.mockResolvedValueOnce({
      analytics: {
        subjectPassRates: [{ subject: "Quran", total: 2, passed: 1, passRatePct: 50 }],
        gradeDistribution: [{ grade: "A+", count: 1 }],
        topPerformers: [{ studentId: "s-1", averagePct: 90, exams: 1 }],
        sectionAverages: [{ label: "Class 5", total: 2, averagePct: 75 }],
      },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/report-aggregates",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { analytics?: { subjectPassRates: unknown[] } };
    expect(body.analytics?.subjectPassRates).toHaveLength(1);
    await app.close();
  });
});

describe("examinations bulk marks write", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps a locked (published) write to 409", async () => {
    const { ConflictError } = await import("../lib/httpErrors.js");
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      upsertExamResults: ReturnType<typeof vi.fn>;
    };
    useCases.upsertExamResults.mockRejectedValueOnce(
      new ConflictError("Results are published", "exam_results_finalized"),
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/results/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: [{ id: "r-1", examId: "e-1", studentId: "s-1", marksObtained: 80 }],
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "exam_results_finalized" });
    await app.close();
  });

  it("rejects a marks body without marksObtained instead of silently recording zero", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/results/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      // The contract's strict write schema requires the mark; the old record schema defaulted it
      // to 0, turning an omitted field into a real (failed) score.
      payload: [{ id: "r-1", examId: "e-1", studentId: "s-1" }],
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects moderation fields on a plain marks save", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/results/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: [{ id: "r-1", examId: "e-1", studentId: "s-1", marksObtained: 80, graceMarks: 2 }],
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe("examinations widget aggregates and bulk delete routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/examinations/widget-aggregates returns SQL-backed widget results", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExaminationsWidgetAggregates: ReturnType<typeof vi.fn>;
    };
    useCases.loadExaminationsWidgetAggregates.mockResolvedValueOnce({
      "w-1": { value: 3, totalCount: 5, chartData: [] },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/widget-aggregates",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { widgets: [{ id: "w-1", operation: "count" }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ "w-1": { value: 3, totalCount: 5 } });
    await app.close();
  });

  it("POST /api/examinations/exams/bulk-delete forwards ids and reports the result", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      bulkSoftDeleteExams: ReturnType<typeof vi.fn>;
    };
    useCases.bulkSoftDeleteExams.mockResolvedValueOnce({ succeeded: 1, failed: 0 });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/bulk-delete",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { ids: ["e-1"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, succeeded: 1, failed: 0 });
    expect(useCases.bulkSoftDeleteExams).toHaveBeenCalledWith(["e-1"], "u-admin", undefined);
    await app.close();
  });
});

describe("examinations bulk exam upsert (contract path used by the UI)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PUT /api/examinations/exams/bulk saves through the contract path", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/exams/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: [
        {
          id: "e-1",
          name: "Midterm",
          subject: "Quran",
          totalMarks: 100,
          passingMarks: 50,
          date: "2026-03-10",
          duration: 60,
          classIds: ["c-1"],
          status: "scheduled",
          description: "",
        },
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    await app.close();
  });

  it("POST /api/examinations/exams/:id/results/export responds through the contract path", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/results/export",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
    });
    expect([202, 404, 503]).toContain(res.statusCode);
    await app.close();
  });

  it("POST /api/examinations/exams/:id/results/import responds through the contract path", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/results/import",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { rows: [] },
    });
    expect([202, 400, 404, 503]).toContain(res.statusCode);
    await app.close();
  });
});

describe("examinations strict request validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unknown query keys, invalid page sizes and unknown statuses", async () => {
    const app = await buildApp();
    const headers = { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` };
    for (const url of [
      "/api/examinations/exams?limit=101",
      "/api/examinations/exams?page=0",
      "/api/examinations/exams?status=upcoming,bogus",
      "/api/examinations/exams?unexpected=1",
    ]) {
      const res = await app.inject({ method: "GET", url, headers });
      expect(res.statusCode, url).toBe(400);
      expect(res.json()).toMatchObject({ type: "validation_error" });
    }
    await app.close();
  });

  it("rejects an overlong student id before the handler runs", async () => {
    const app = await buildApp();
    // Fastify's own maxParamLength is 100, so a >100 id answers 414; 65 characters is inside the
    // router limit but above the contract's `studentId` cap, so ts-rest validation must answer 400.
    const res = await app.inject({
      method: "POST",
      url: `/api/examinations/exams/e-1/results/${"s".repeat(65)}/moderation`,
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { graceMarks: 1, reason: "board moderation" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "validation_error" });
    await app.close();
  });
});

describe("examinations gate, override and publication routes", () => {
  const EXAM = {
    id: "e-1",
    name: "Midterm",
    subject: "Quran",
    totalMarks: 100,
    passingMarks: 50,
    duration: 60,
    classIds: ["c-1"],
    status: "ongoing",
    description: "",
    date: "2026-03-10",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function mockLoadedExam() {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExamById: ReturnType<typeof vi.fn>;
    };
    useCases.loadExamById.mockResolvedValue(EXAM);
    return useCases;
  }

  it("GET .../eligibility returns the per-student view", async () => {
    await mockLoadedExam();
    mockGetEligibilityView.mockResolvedValueOnce({
      examId: "e-1",
      requiredPct: 75,
      rows: [
        {
          studentId: "s-1",
          studentName: "Aisha",
          classId: "c-1",
          state: "eligible",
          attendancePct: 90,
          requiredPct: 75,
          overridden: false,
        },
      ],
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/exams/e-1/eligibility",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      examId: "e-1",
      requiredPct: 75,
      students: [{ studentId: "s-1", state: "eligible" }],
    });
    await app.close();
  });

  it("PUT .../attendance-gate validates the threshold and persists it", async () => {
    mockConfigureGate.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/exams/e-1/attendance-gate",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { minAttendancePct: 74.5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ examId: "e-1", minAttendancePct: 74.5 });
    expect(mockConfigureGate).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ examId: "e-1", minAttendancePct: 74.5 }),
    );
    await app.close();
  });

  it("POST override and revoke both answer with success", async () => {
    mockGrantOverride.mockResolvedValueOnce(undefined);
    mockRevokeOverride.mockResolvedValueOnce({ success: true });
    const app = await buildApp();
    const headers = { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` };

    const grant = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/eligibility-overrides",
      headers,
      payload: { studentId: "s-1", reason: "medical leave evidenced" },
    });
    expect(grant.statusCode).toBe(200);
    expect(grant.json()).toEqual({ success: true });

    const revoke = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/eligibility-overrides/s-1/revoke",
      headers,
      payload: { reason: "leave withdrawn" },
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json()).toEqual({ success: true });
    await app.close();
  });

  it("POST results-finalization publishes and serializes the stamp", async () => {
    const finalizedAt = new Date("2026-03-11T00:00:00.000Z");
    mockPublishExamResults.mockResolvedValueOnce({
      examId: "e-1",
      resultsFinalizedAt: finalizedAt,
      status: "completed",
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/results-finalization",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { finalized: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      examId: "e-1",
      resultsFinalizedAt: "2026-03-11T00:00:00.000Z",
      status: "completed",
    });
    await app.close();
  });

  it("serializes a publication rejection with its structured details", async () => {
    const { ConflictError } = await import("../lib/httpErrors.js");
    mockPublishExamResults.mockRejectedValueOnce(
      new ConflictError("Exam e-1 has not been sat yet", "exam_not_sat", { examId: "e-1" }),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/e-1/results-finalization",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { finalized: true },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ type: "exam_not_sat", details: { examId: "e-1" } });
    await app.close();
  });

  it("serves the Setup field-config and preferences reads", async () => {
    const app = await buildApp();
    const headers = { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` };
    const config = await app.inject({
      method: "GET",
      url: "/api/examinations/field-config",
      headers,
    });
    expect(config.statusCode).toBe(200);
    expect(config.json()).toMatchObject({ config: { tabs: [] } });

    const preferences = await app.inject({
      method: "GET",
      url: "/api/examinations/preferences",
      headers,
    });
    expect(preferences.statusCode).toBe(200);
    expect(preferences.json()).toHaveProperty("preferences");
    await app.close();
  });
});

describe("examinations serialization privacy on every read path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forbids a guardian token on the marks list and the broadsheet export", async () => {
    const app = await buildApp();
    for (const [method, url] of [
      ["GET", "/api/examinations/results"],
      ["POST", "/api/examinations/exams/e-1/results/export"],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { host: "demo.localhost", authorization: `Bearer ${guardianToken(app)}` },
      });
      expect(res.statusCode, url).toBe(403);
      expect(res.body).not.toContain("marksObtained");
    }
    await app.close();
  });

  it("asks a reader's report aggregates to include only published marks", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as {
      loadExaminationsReportAggregates: ReturnType<typeof vi.fn>;
    };
    useCases.loadExaminationsReportAggregates.mockResolvedValueOnce({});

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/examinations/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "auditor" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(useCases.loadExaminationsReportAggregates).toHaveBeenCalledWith(undefined, {
      publishedOnly: true,
    });
    await app.close();
  });
});

describe("examinations bulk writes keep structured errors and strict inputs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseExam = {
    id: "e-1",
    name: "Midterm",
    subject: "Quran",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-03-10",
    duration: 60,
    classIds: ["c-1"],
    status: "scheduled",
    description: "",
  };

  it("forwards the gate's structured details on a blocked marks save", async () => {
    const { HttpDomainError } = await import("../lib/httpErrors.js");
    mockAuthorizeAndStamp.mockRejectedValueOnce(
      new HttpDomainError(409, "exam_eligibility_blocked", "Below the exam attendance threshold", {
        details: {
          examId: "e-1",
          students: [
            {
              examId: "e-1",
              studentId: "s-1",
              attendancePct: 40,
              requiredPct: 75,
              state: "blocked",
            },
          ],
          counts: { outOfRange: 0, notEnrolled: 0, unknown: 0, blocked: 1 },
          truncated: false,
        },
      }),
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/results/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: [{ id: "r-1", examId: "e-1", studentId: "s-1", marksObtained: 80 }],
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      type: "exam_eligibility_blocked",
      details: { students: [{ studentId: "s-1", state: "blocked" }] },
    });
    await app.close();
  });

  it("rejects an invalid exam date, passing marks above the total and a blank name", async () => {
    const app = await buildApp();
    const headers = { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` };
    for (const payload of [
      [{ ...baseExam, date: "2026-02-31" }],
      [{ ...baseExam, passingMarks: 120 }],
      [{ ...baseExam, name: "" }],
    ]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/examinations/exams/bulk",
        headers,
        payload,
      });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    await app.close();
  });

  it("accepts the read-only metadata the list round-trips without writing it", async () => {
    const useCases = (await import("../examinations/use-cases/examinationsUseCases.js"))
      .examinationsUseCases as unknown as { upsertExams: ReturnType<typeof vi.fn> };
    useCases.upsertExams.mockClear();

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/examinations/exams/bulk",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: [
        {
          ...baseExam,
          resultsFinalizedAt: null,
          deletedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          minAttendancePct: 75,
        },
      ],
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(useCases.upsertExams).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
