/**
 * Section-scope enforcement on the students write/read surfaces (review A1).
 *
 * A section-limited teacher must not bulk-mutate, export, or count students outside
 * their assigned sections; unrestricted roles keep the tenant-wide behaviour.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, teacherToken } from "./helpers/tokens.js";

const mockBulkUpdateStatus = vi.fn();
const mockCountStudents = vi.fn();
const mockDuplicateCheck = vi.fn();
const mockCommandMetrics = vi.fn();
const mockWidgetAggregates = vi.fn();
const mockFilterScopedIds = vi.fn();
const mockResolveScope = vi.fn();
const mockEnqueueCsvExportJob = vi.fn();

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/auth/authArtifactService.js")>()),
  deleteRefreshTokensForUser: vi.fn(),
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),

  authArtifactUserScopeKey: vi.fn(() => ""),
  authArtifactWorkspaceScopeKey: vi.fn(() => ""),
  deleteAuthArtifact: vi.fn().mockResolvedValue(undefined),
  findAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  tryClaimAuthArtifactByLookupKey: vi.fn().mockResolvedValue(null),
  updateAuthArtifactPayload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  return {
    ...actual,
    getWorkspaceBySubdomain: vi.fn(async (subdomain: string) =>
      subdomain === "demo"
        ? {
            id: "ws-demo",
            subdomain: "demo",
            madrasaName: "Demo Madrasa",
            createdAt: "2026-01-01T00:00:00.000Z",
            enabled: true,
          }
        : null,
    ),
  };
});

vi.mock("@mms/mod-students/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-students/backend/use-cases")>();
  return {
    ...actual,
    loadStudentFieldConfig: vi.fn().mockResolvedValue(null),
    saveStudentFieldConfig: vi.fn(),
    loadStudentsSettingsCombined: vi.fn().mockResolvedValue(null),
    studentUseCases: {
      ...actual.studentUseCases,
      bulkUpdateStudentStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
      countStudents: (...args: unknown[]) => mockCountStudents(...args),
      checkStudentRegistrationDuplicate: (...args: unknown[]) => mockDuplicateCheck(...args),
      loadStudentsCommandMetrics: (...args: unknown[]) => mockCommandMetrics(...args),
      loadStudentsWidgetAggregates: (...args: unknown[]) => mockWidgetAggregates(...args),
      loadStudentsPage: vi.fn(async () => ({
        students: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      })),
      sanitizeStudentForViewer: async (student: unknown) => student,
      sanitizeStudentsForViewer: async (students: unknown) => students,
    },
  };
});

vi.mock("@mms/mod-students/backend/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-students/backend/repository")>();
  return {
    ...actual,
    resolveStudentAccessScope: (...args: unknown[]) => mockResolveScope(...args),
    filterStudentIdsInAssignedSections: (...args: unknown[]) => mockFilterScopedIds(...args),
  };
});

vi.mock("../lib/csvExportEnqueue.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/csvExportEnqueue.js")>();
  return {
    ...actual,
    enqueueCsvExportJob: (...args: unknown[]) => mockEnqueueCsvExportJob(...args),
  };
});

vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobWorkerService.js")>();
  return {
    ...actual,
    hasBackgroundJobRunner: () => true,
    enqueueBackgroundJob: vi.fn().mockResolvedValue(null),
    getUserBackgroundJob: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    hashPrevious: "0".repeat(64),
    hashCurrent: "1".repeat(64),
    canonicalPayload: "{}",
  }),
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

vi.mock("@mms/mod-students/backend/services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-students/backend/services")>()),
  validateStudentDynamic: vi.fn().mockResolvedValue(undefined),
}));

describe("students section scope on write/read surfaces", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
    mockResolveScope.mockImplementation(async (_tenant: unknown, user: { role?: string }) =>
      user.role === "teacher"
        ? { isUnrestricted: false, assignedSectionIds: ["sec-1"] }
        : { isUnrestricted: true, assignedSectionIds: [] },
    );
    mockFilterScopedIds.mockImplementation(async (_tenant: unknown, ids: string[]) =>
      ids.filter((id) => id === "s-in"),
    );
    mockBulkUpdateStatus.mockResolvedValue({ succeeded: 1, failed: 0 });
    mockEnqueueCsvExportJob.mockResolvedValue({ id: "job-1" });
    mockCountStudents.mockResolvedValue(1);
    mockDuplicateCheck.mockResolvedValue({ reason: null });
    mockCommandMetrics.mockResolvedValue({
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      newThisPeriod: 0,
    });
    mockWidgetAggregates.mockResolvedValue({});
  });

  it("filters bulk-status ids to the teacher's sections and reports denied ids failed", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s-in", "s-out"], status: "inactive" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockBulkUpdateStatus).toHaveBeenCalledWith(["s-in"], "inactive", expect.anything());
    expect(res.json()).toMatchObject({ success: true, succeeded: 1, failed: 1 });
    await app.close();
  });

  it("scopes the duplicate probe for a section-limited teacher", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/duplicate-check",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { grNumber: "GR-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDuplicateCheck).toHaveBeenCalledWith({ grNumber: "GR-1" }, "demo", {
      scopedSectionIds: ["sec-1"],
    });
    await app.close();
  });

  it("scopes the count endpoint for a section-limited teacher", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/students/count",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockCountStudents).toHaveBeenCalledWith({ scopedSectionIds: ["sec-1"] });
    await app.close();
  });

  it("scopes the metrics and widget aggregates for a section-limited teacher", async () => {
    const app = await buildApp();
    const metrics = await app.inject({
      method: "GET",
      url: "/api/students/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(metrics.statusCode).toBe(200);
    expect(mockCommandMetrics).toHaveBeenCalledWith({ scopedSectionIds: ["sec-1"] });

    const widgets = await app.inject({
      method: "POST",
      url: "/api/students/widget-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { widgets: [{ id: "w1", operation: "count" }] },
    });
    expect(widgets.statusCode).toBe(200);
    expect(mockWidgetAggregates).toHaveBeenCalledWith([{ id: "w1", operation: "count" }], {
      scopedSectionIds: ["sec-1"],
    });
    await app.close();
  });

  it("keeps admin count tenant-wide", async () => {
    const app = await buildApp();
    await app.inject({
      method: "GET",
      url: "/api/students/count",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });

    expect(mockCountStudents).toHaveBeenCalledWith({ scopedSectionIds: undefined });
    await app.close();
  });

  it("injects the section scope into the export job query", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { query: {} },
    });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockEnqueueCsvExportJob).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ scopedSectionIds: ["sec-1"] }) }),
    );
    await app.close();
  });

  it("rejects an id selection with no in-scope students instead of exporting the roster", async () => {
    mockFilterScopedIds.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/students/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      payload: { query: {}, ids: ["s-out"] },
    });

    expect(res.statusCode).toBe(403);
    expect(mockEnqueueCsvExportJob).not.toHaveBeenCalled();
    await app.close();
  });
});
