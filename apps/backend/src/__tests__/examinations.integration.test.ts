import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import {
  adminToken,
  assistantTeacherToken,
  guardianToken,
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
const mockLoadExaminationsCommandMetrics = vi.fn();

vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: {
    loadExams: (...args: unknown[]) => mockLoadExams(...args),
    loadExamsPage: (...args: unknown[]) => mockLoadExamsPage(...args),
    upsertExams: vi.fn().mockResolvedValue([]),
    replaceExams: vi.fn(),
    loadExamResults: vi.fn().mockResolvedValue([]),
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
