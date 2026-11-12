import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import {
  adminToken,
  assistantTeacherToken,
  guardianToken,
  signTenantToken,
  teacherToken,
} from "./helpers/tokens.js";
import type { QuestionBankQuestion, QuestionBankTest, QuestionBankResult } from "@mms/shared";

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
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockEnqueueCsvExportJob = vi.fn();
const mockRecordAuditEvent = vi.fn().mockResolvedValue({ sequence: 1 });

vi.mock("../lib/csvExportEnqueue.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    enqueueCsvExportJob: (...args: unknown[]) => mockEnqueueCsvExportJob(...args),
  };
});

vi.mock("../services/auditTrailService.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    recordModernAuditEvent: (...args: unknown[]) => mockRecordAuditEvent(...args),
  };
});

const mockLoadQuestions = vi.fn();
const mockLoadQuestionsPage = vi.fn();
const mockLoadQuestionsPicker = vi.fn();
const mockUpsertQuestions = vi.fn();
const mockLoadTests = vi.fn();
const mockUpsertTests = vi.fn();
const mockLoadResults = vi.fn();
const mockUpsertResults = vi.fn();
const mockDeleteQuestionById = vi.fn();
const mockRestoreQuestionById = vi.fn();
const mockBulkSoftDeleteQuestions = vi.fn();
const mockBulkRestoreQuestions = vi.fn();
const mockLoadQuestionBankCommandMetrics = vi.fn();

vi.mock("../questionBank/use-cases/questionBankUseCases.js", () => ({
  questionBankUseCases: {
    loadQuestions: (...args: unknown[]) => mockLoadQuestions(...args),
    loadQuestionsPage: (...args: unknown[]) => mockLoadQuestionsPage(...args),
    loadQuestionsPicker: (...args: unknown[]) => mockLoadQuestionsPicker(...args),
    upsertQuestions: (...args: unknown[]) => mockUpsertQuestions(...args),
    loadTests: (...args: unknown[]) => mockLoadTests(...args),
    upsertTests: (...args: unknown[]) => mockUpsertTests(...args),
    loadResults: (...args: unknown[]) => mockLoadResults(...args),
    upsertResults: (...args: unknown[]) => mockUpsertResults(...args),
    deleteQuestionById: (...args: unknown[]) => mockDeleteQuestionById(...args),
    restoreQuestionById: (...args: unknown[]) => mockRestoreQuestionById(...args),
    bulkSoftDeleteQuestions: (...args: unknown[]) => mockBulkSoftDeleteQuestions(...args),
    bulkRestoreQuestions: (...args: unknown[]) => mockBulkRestoreQuestions(...args),
    loadQuestionBankCommandMetrics: (...args: unknown[]) =>
      mockLoadQuestionBankCommandMetrics(...args),
    loadQuestionBankWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadQuestionBankReportAggregates: vi.fn().mockResolvedValue({}),
    replaceQuestions: vi.fn(),
    replaceTests: vi.fn(),
    replaceResults: vi.fn(),
  },
}));

const mockGetUserColumnPreferencesForModule = vi.fn();
const mockSetUserColumnPreferencesForModule = vi.fn();

vi.mock("../services/userColumnPreferencesService.js", () => ({
  getUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockGetUserColumnPreferencesForModule(...args),
  setUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockSetUserColumnPreferencesForModule(...args),
}));

const sampleQuestion: QuestionBankQuestion = {
  id: "q-1",
  categoryIds: ["cat-1"],
  categoryId: "cat-1",
  type: "mcq",
  difficulty: "easy",
  questionLanguage: "en",
  text: "Simple Question",
  options: ["A", "B", "C", "D"],
  answer: "A",
};

const sampleTest: QuestionBankTest = {
  id: "t-1",
  name: "Test 1",
  categoryId: "cat-1",
  questionIds: ["q-1"],
  difficulty: "easy",
  duration: 10,
  createdAt: "2026-06-26",
};

const samplePaperTest: QuestionBankTest = {
  id: "paper-1",
  name: "Manual Paper",
  categoryId: null,
  questionIds: ["q-1", "q-2"],
  difficulty: "mixed",
  duration: 45,
  createdAt: "2026-06-27T10:00:00.000Z",
  examClass: "Hifz Level 2",
  totalMarks: 100,
  instructions: "Answer all questions.",
  sections: [
    {
      id: "section-a",
      title: "Part A",
      instructions: "Choose the correct answer.",
      questionIds: ["q-1"],
    },
    {
      id: "section-b",
      title: "Part B",
      instructions: "Write short answers.",
      questionIds: ["q-2"],
    },
  ],
};

const sampleResult: QuestionBankResult = {
  id: "r-1",
  testId: "t-1",
  studentId: "s-1",
  studentName: "Ahmed",
  submittedAt: "2026-06-26",
  answers: { "q-1": "A" },
  scores: { "q-1": 1 },
};

describe("question bank REST routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadQuestions.mockReset().mockResolvedValue([sampleQuestion]);
    mockUpsertQuestions.mockReset().mockResolvedValue([sampleQuestion]);
    mockLoadTests.mockReset().mockResolvedValue([sampleTest]);
    mockUpsertTests.mockReset().mockResolvedValue([sampleTest]);
    mockLoadResults.mockReset().mockResolvedValue([sampleResult]);
    mockUpsertResults.mockReset().mockResolvedValue([sampleResult]);
    mockDeleteQuestionById.mockReset().mockResolvedValue(true);
    mockRestoreQuestionById.mockReset().mockResolvedValue(true);
    mockBulkSoftDeleteQuestions.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockBulkRestoreQuestions.mockReset().mockResolvedValue({ succeeded: 1, failed: 0 });
    mockGetUserColumnPreferencesForModule.mockReset().mockResolvedValue([]);
    mockSetUserColumnPreferencesForModule.mockReset().mockResolvedValue(undefined);
    mockLoadQuestionBankCommandMetrics.mockReset().mockResolvedValue({
      total: 1,
      easy: 1,
      medium: 0,
      hard: 0,
      totalTests: 1,
      totalResults: 0,
      categories: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/question-bank/questions requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/question-bank/questions returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
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
    await app.close();
  });

  it("GET /api/question-bank/questions loads questions for authorized users", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ questions: [sampleQuestion] });
    expect(mockLoadQuestions).toHaveBeenCalledWith({ includeDeleted: false });
    await app.close();
  });

  it("PUT /api/question-bank/questions/bulk upserts questions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/question-bank/questions/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleQuestion]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ questions: [sampleQuestion] });
    expect(mockUpsertQuestions).toHaveBeenCalledWith([sampleQuestion]);
    await app.close();
  });

  it("DELETE /api/question-bank/questions/:id soft-deletes a question", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/question-bank/questions/q-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteQuestionById).toHaveBeenCalledWith("q-1", "u-teacher");
    await app.close();
  });

  it("POST /api/question-bank/questions/:id/restore restores a question", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreQuestionById).toHaveBeenCalledWith("q-1", "u-teacher");
    await app.close();
  });

  it("GET /api/question-bank/questions?includeDeleted=true loads trash", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadQuestions).toHaveBeenCalledWith({ includeDeleted: true });
    await app.close();
  });

  it("GET /api/question-bank/tests loads tests", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/tests",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tests: [sampleTest] });
    expect(mockLoadTests).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/question-bank/tests/bulk updates tests", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/question-bank/tests/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleTest]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tests: [sampleTest] });
    expect(mockUpsertTests).toHaveBeenCalledWith([sampleTest]);
    await app.close();
  });

  it("PUT /api/question-bank/tests/bulk preserves manual paper builder metadata", async () => {
    mockUpsertTests.mockResolvedValueOnce([samplePaperTest]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/question-bank/tests/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([samplePaperTest]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tests: [samplePaperTest] });
    expect(mockUpsertTests).toHaveBeenCalledWith([samplePaperTest]);
    await app.close();
  });

  it("GET /api/question-bank/assessment-results loads results", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/assessment-results",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [sampleResult] });
    expect(mockLoadResults).toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/question-bank/assessment-results/bulk updates results", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/question-bank/assessment-results/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([sampleResult]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ results: [sampleResult] });
    expect(mockUpsertResults).toHaveBeenCalledWith([sampleResult]);
    await app.close();
  });

  it("GET /api/question-bank/metrics loads metrics", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 1,
        easy: 1,
        medium: 0,
        hard: 0,
        totalTests: 1,
        totalResults: 0,
        categories: 0,
      },
    });
    expect(mockLoadQuestionBankCommandMetrics).toHaveBeenCalled();
    await app.close();
  });
});

describe("question bank questions pagination", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadQuestionsPage.mockReset().mockResolvedValue({
      questions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/question-bank/questions returns paginated shape and forwards filters", async () => {
    const pageQuestion = {
      id: "q-9",
      categoryIds: ["cat-1"],
      categoryId: "cat-1",
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "What is wudu?",
      options: [],
      answer: "ritual purity",
      marks: 1,
    };
    mockLoadQuestionsPage.mockResolvedValueOnce({
      questions: [pageQuestion],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions?page=1&limit=10&search=wudu&categoryId=cat-1&difficulty=easy",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      questions: [pageQuestion],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    expect(mockLoadQuestionsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        search: "wudu",
        categoryId: "cat-1",
        difficulty: "easy",
        includeDeleted: false,
      }),
    );
    await app.close();
  });

  it("includeDeleted=true forwards deleted-only request for admins", async () => {
    mockLoadQuestionsPage.mockResolvedValueOnce({
      questions: [
        {
          id: "q-8",
          categoryIds: ["cat-1"],
          type: "short",
          difficulty: "easy",
          questionLanguage: "en",
          text: "Archived question",
          options: [],
          answer: "archived",
          marks: 1,
          deletedAt: "2026-07-27T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadQuestionsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    expect(typeof res.json().questions[0]?.deletedAt).toBe("string");
    expect(res.json().questions[0]?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });

  it("forbids includeDeleted for roles without delete access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${assistantTeacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadQuestionsPage).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("answer-key redaction and request validation", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadQuestions.mockReset().mockResolvedValue([]);
    mockLoadQuestionsPicker.mockReset().mockResolvedValue({
      questions: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    mockBulkSoftDeleteQuestions.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("strips the answer key for a read-only caller", async () => {
    mockLoadQuestions.mockResolvedValueOnce([sampleQuestion]);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "auditor" })}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { questions: Array<Record<string, unknown>> };
    expect(body.questions[0]).not.toHaveProperty("answer");
    expect(body.questions[0]?.text).toBe("Simple Question");
    await app.close();
  });

  it("keeps the answer key for a caller with write authority", async () => {
    mockLoadQuestions.mockResolvedValueOnce([sampleQuestion]);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { questions: Array<Record<string, unknown>> };
    expect(body.questions[0]?.answer).toBe("A");
    await app.close();
  });

  it("never returns the answer key from the picker, even for an admin", async () => {
    mockLoadQuestionsPicker.mockResolvedValueOnce({
      questions: [sampleQuestion],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions/picker?limit=20&difficulty=easy",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { questions: Array<Record<string, unknown>> };
    expect(body.questions[0]).not.toHaveProperty("answer");
    expect(mockLoadQuestionsPicker).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, difficulty: "easy" }),
    );
    await app.close();
  });

  it("rejects an out-of-range limit and an unknown status before the use case runs", async () => {
    const app = await buildApp();
    for (const url of [
      "/api/question-bank/questions?limit=101",
      "/api/question-bank/questions?status=bogus",
      "/api/question-bank/questions?difficulty=extreme",
      "/api/question-bank/questions?unknownFilter=1",
    ]) {
      const res = await app.inject({
        method: "GET",
        url,
        headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      });
      expect(res.statusCode, url).toBe(400);
    }
    expect(mockLoadQuestionsPage).not.toHaveBeenCalled();
    await app.close();
  });

  it("validates the action body schemas", async () => {
    const app = await buildApp();
    const statusRes = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/status",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { status: "bogus" },
    });
    expect(statusRes.statusCode).toBe(400);

    const attachmentRes = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/attachments",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { kind: "bogus", url: "x", name: "x", mime: "x", size: 1 },
    });
    expect(attachmentRes.statusCode).toBe(400);
    await app.close();
  });

  it("maps a constraint failure on bulk delete to a 4xx instead of a 500", async () => {
    mockBulkSoftDeleteQuestions.mockRejectedValueOnce(
      Object.assign(new Error("guarded"), { code: "23514" }),
    );
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/bulk-delete",
      headers: { host: "demo.localhost", authorization: `Bearer ${adminToken(app)}` },
      payload: { ids: ["q-1"] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "constraint_violation" });
    await app.close();
  });
});

describe("question bank RBAC (module-scoped permissions)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadQuestions.mockReset().mockResolvedValue([]);
    mockLoadQuestionsPage.mockReset().mockResolvedValue({
      questions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    mockUpsertQuestions.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getQuestionsAs(role: "assistant_teacher" | "registrar" | "auditor" | "teacher") {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role })}`,
      },
    });
    await app.close();
    return res.statusCode;
  }

  it("denies roles that only hold Students permissions", async () => {
    // These roles have students.read but no questionBank grant: the old manifest mapping let them in.
    expect(await getQuestionsAs("assistant_teacher")).toBe(403);
    expect(await getQuestionsAs("registrar")).toBe(403);
  });

  it("allows the read-only auditor to read but not write", async () => {
    expect(await getQuestionsAs("auditor")).toBe(200);

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/question-bank/questions/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "auditor" })}`,
      },
      payload: [sampleQuestion],
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("lets a teacher author but not approve or retire", async () => {
    const app = await buildApp();
    const read = await app.inject({
      method: "GET",
      url: "/api/question-bank/questions",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
    });
    expect(read.statusCode).toBe(200);

    const approve = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/status",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { status: "approved" },
    });
    expect(approve.statusCode).toBe(403);

    // Submit-for-review is authoring authority and reaches body validation (not 403).
    const submit = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/status",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: { status: "bogus" },
    });
    expect(submit.statusCode).toBe(400);
    await app.close();
  });

  it("lets an approver reach the approve path", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/question-bank/questions/q-1/status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "principal" })}`,
      },
      payload: { status: "bogus" },
    });
    // 400 means the permission gate passed and the body schema rejected the status.
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("reserves the master answer-key export for approvers", async () => {
    mockEnqueueCsvExportJob.mockResolvedValueOnce({
      id: "job-export-1",
      status: "pending",
      moduleId: "questionBank",
      kind: "export",
      label: "Exporting questions",
    });
    const app = await buildApp();
    const teacherExport = await app.inject({
      method: "POST",
      url: "/api/question-bank/export/csv",
      headers: { host: "demo.localhost", authorization: `Bearer ${teacherToken(app)}` },
      payload: {},
    });
    expect(teacherExport.statusCode).toBe(403);

    const principalExport = await app.inject({
      method: "POST",
      url: "/api/question-bank/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "principal" })}`,
      },
      payload: {},
    });
    // The approver passes the gate and the job is queued; the teacher never reaches the enqueue.
    expect(principalExport.statusCode).toBe(202);
    expect(mockEnqueueCsvExportJob).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
