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
// route-level contract test can assert the locked-write mapping without a database.
vi.mock("../examinations/use-cases/examResultsSubmission.js", () => ({
  authorizeAndStampExamResults: async (
    user: { id: string },
    results: Array<Record<string, unknown>>,
  ) => results.map((result) => ({ ...result, markedBy: user.id })),
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
});
