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

const mockLoadFacultyPage = vi.fn();
const mockDeleteFacultyById = vi.fn();
const mockRestoreFacultyById = vi.fn();
const mockBulkSoftDeleteFaculty = vi.fn();
const mockBulkRestoreFaculty = vi.fn();
const mockBulkUpdateFacultyStatus = vi.fn();

vi.mock("../faculty/use-cases/facultyUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../faculty/use-cases/facultyUseCases.js")>();
  const mocked = {
    ...actual.facultyUseCases,
    loadFacultyPage: (...args: unknown[]) => mockLoadFacultyPage(...args),
    deleteFacultyById: (...args: unknown[]) => mockDeleteFacultyById(...args),
    softDeleteFacultyById: (...args: unknown[]) => mockDeleteFacultyById(...args),
    restoreFacultyById: (...args: unknown[]) => mockRestoreFacultyById(...args),
    bulkSoftDeleteFaculty: (...args: unknown[]) => mockBulkSoftDeleteFaculty(...args),
    bulkRestoreFaculty: (...args: unknown[]) => mockBulkRestoreFaculty(...args),
    bulkUpdateFacultyStatus: (...args: unknown[]) => mockBulkUpdateFacultyStatus(...args),
    sanitizeFacultyForViewer: async (faculty: unknown) => faculty,
    sanitizeFacultyListForViewer: async (facultyList: unknown) => facultyList,
  };
  return {
    ...actual,
    facultyUseCases: mocked,
  };
});

describe("faculty soft delete routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("DELETE /api/faculty/:id soft-deletes faculty member", async () => {
    mockDeleteFacultyById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/faculty/t1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Left faculty" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteFacultyById).toHaveBeenCalledWith("t1", "u-admin", "Left faculty");
    await app.close();
  });

  it("POST /api/faculty/:id/restore restores a faculty member", async () => {
    mockRestoreFacultyById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/t1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreFacultyById).toHaveBeenCalledWith("t1", "u-admin");
    await app.close();
  });

  it("GET /api/faculty lists with includeDeleted options", async () => {
    mockLoadFacultyPage.mockResolvedValue({
      faculty: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/faculty?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadFacultyPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("POST /api/faculty/bulk-delete soft-deletes multiple faculty members", async () => {
    mockBulkSoftDeleteFaculty.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["t1", "t2"], deletionReason: "Bulk archive" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkSoftDeleteFaculty).toHaveBeenCalledWith(["t1", "t2"], "u-admin", "Bulk archive");
    await app.close();
  });

  it("POST /api/faculty/bulk-restore restores multiple faculty members", async () => {
    mockBulkRestoreFaculty.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["t1", "t2"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkRestoreFaculty).toHaveBeenCalledWith(["t1", "t2"], "u-admin");
    await app.close();
  });

  it("POST /api/faculty/bulk-status updates faculty status", async () => {
    mockBulkUpdateFacultyStatus.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["t1"], status: "on_leave" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 1, failed: 0 });
    expect(mockBulkUpdateFacultyStatus).toHaveBeenCalledWith(["t1"], "on_leave");
    await app.close();
  });

  it("POST /api/faculty/bulk-status accepts custom lookup statuses", async () => {
    mockBulkUpdateFacultyStatus.mockResolvedValue({ succeeded: 1, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/faculty/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["t1"], status: "on_leave" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockBulkUpdateFacultyStatus).toHaveBeenCalledWith(["t1"], "on_leave");
    await app.close();
  });
});
