import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken } from "./helpers/tokens.js";

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

const mockLoadEnrollmentsPage = vi.fn();
const mockDeleteEnrollmentById = vi.fn();
const mockRestoreEnrollmentById = vi.fn();
const mockBulkSoftDeleteEnrollments = vi.fn();
const mockBulkRestoreEnrollments = vi.fn();

vi.mock("../enrollments/use-cases/enrollmentsUseCases.js", () => ({
  enrollmentsUseCases: {
    loadEnrollmentsPage: (...args: unknown[]) => mockLoadEnrollmentsPage(...args),
    deleteEnrollmentById: (...args: unknown[]) => mockDeleteEnrollmentById(...args),
    restoreEnrollmentById: (...args: unknown[]) => mockRestoreEnrollmentById(...args),
    bulkSoftDeleteEnrollments: (...args: unknown[]) => mockBulkSoftDeleteEnrollments(...args),
    bulkRestoreEnrollments: (...args: unknown[]) => mockBulkRestoreEnrollments(...args),
    countEnrollments: vi.fn().mockResolvedValue(0),
    loadEnrollmentsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadEnrollmentsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadEnrollmentsReportAggregates: vi.fn().mockResolvedValue({}),
    createEnrollment: vi.fn(),
    updateEnrollmentById: vi.fn(),
    loadEnrollmentsByIds: vi.fn().mockResolvedValue([]),
  },
}));

describe("enrollments soft delete routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("DELETE /api/enrollments/:id soft-deletes enrollment", async () => {
    mockDeleteEnrollmentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/enrollments/enr1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteEnrollmentById).toHaveBeenCalledWith("enr1", "u-admin", undefined);
    await app.close();
  });

  it("DELETE /api/enrollments/:id forwards deletionReason", async () => {
    mockDeleteEnrollmentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/enrollments/enr1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Duplicate enrollment" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteEnrollmentById).toHaveBeenCalledWith(
      "enr1",
      "u-admin",
      "Duplicate enrollment",
    );
    await app.close();
  });

  it("POST /api/enrollments/:id/restore restores an enrollment", async () => {
    mockRestoreEnrollmentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/enr1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreEnrollmentById).toHaveBeenCalledWith("enr1", "u-admin");
    await app.close();
  });

  it("GET /api/enrollments lists with includeDeleted options", async () => {
    mockLoadEnrollmentsPage.mockResolvedValue({
      enrollments: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/enrollments?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadEnrollmentsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("POST /api/enrollments/bulk-delete soft-deletes multiple enrollments", async () => {
    mockBulkSoftDeleteEnrollments.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["enr1", "enr2"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkSoftDeleteEnrollments).toHaveBeenCalledWith(
      ["enr1", "enr2"],
      "u-admin",
      undefined,
    );
    await app.close();
  });

  it("POST /api/enrollments/bulk-delete forwards deletionReason", async () => {
    mockBulkSoftDeleteEnrollments.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["enr1"], deletionReason: "Cleanup" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkSoftDeleteEnrollments).toHaveBeenCalledWith(["enr1"], "u-admin", "Cleanup");
    await app.close();
  });

  it("POST /api/enrollments/bulk-restore restores multiple enrollments", async () => {
    mockBulkRestoreEnrollments.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["enr1", "enr2"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkRestoreEnrollments).toHaveBeenCalledWith(["enr1", "enr2"], "u-admin");
    await app.close();
  });
});
