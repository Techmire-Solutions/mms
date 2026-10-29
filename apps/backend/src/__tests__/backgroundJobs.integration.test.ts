import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import type { BackgroundJobRecord } from "@mms/shared";
import { teacherToken } from "./helpers/tokens.js";

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

const mockListUserBackgroundJobs = vi.fn();
const mockUpsertUserBackgroundJob = vi.fn();
const mockDismissUserBackgroundJob = vi.fn();
const mockClearFinishedUserBackgroundJobs = vi.fn();

vi.mock("../services/backgroundJobService.js", () => ({
  listUserBackgroundJobs: (...args: unknown[]) => mockListUserBackgroundJobs(...args),
  upsertUserBackgroundJob: (...args: unknown[]) => mockUpsertUserBackgroundJob(...args),
  dismissUserBackgroundJob: (...args: unknown[]) => mockDismissUserBackgroundJob(...args),
  clearFinishedUserBackgroundJobs: (...args: unknown[]) =>
    mockClearFinishedUserBackgroundJobs(...args),
}));

const mockGetExportArtifact = vi.fn();
const mockDeleteExportArtifact = vi.fn();
const mockDeleteExportArtifacts = vi.fn();

vi.mock("../services/exportArtifactService.js", () => ({
  getExportArtifact: (...args: unknown[]) => mockGetExportArtifact(...args),
  deleteExportArtifact: (...args: unknown[]) => mockDeleteExportArtifact(...args),
  deleteExportArtifacts: (...args: unknown[]) => mockDeleteExportArtifacts(...args),
  saveExportArtifact: vi.fn(),
}));

const mockGetUserBackgroundJob = vi.fn();

vi.mock("../services/backgroundJobWorkerService.js", () => ({
  getUserBackgroundJob: (...args: unknown[]) => mockGetUserBackgroundJob(...args),
  enqueueBackgroundJob: vi.fn(),
  registerBackgroundJobRunner: vi.fn(),
}));

const sampleJob: BackgroundJobRecord = {
  id: "job-1",
  moduleId: "contacts",
  kind: "export",
  status: "completed",
  label: "Exported 10 contacts",
  createdAt: "2026-06-26T12:00:00.000Z",
  completedAt: "2026-06-26T12:01:00.000Z",
  hasDownload: true,
};

describe("background jobs REST routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockListUserBackgroundJobs.mockReset().mockResolvedValue([sampleJob]);
    mockUpsertUserBackgroundJob.mockReset().mockResolvedValue(sampleJob);
    mockDismissUserBackgroundJob.mockReset().mockResolvedValue("u-teacher");
    mockClearFinishedUserBackgroundJobs.mockReset().mockResolvedValue(["job-1"]);
    mockGetExportArtifact
      .mockReset()
      .mockResolvedValue({ filename: "contacts.csv", content: "id,name\n1,Ali" });
    mockDeleteExportArtifact.mockReset().mockResolvedValue(undefined);
    mockDeleteExportArtifacts.mockReset().mockResolvedValue(1);
    mockGetUserBackgroundJob.mockReset().mockResolvedValue(sampleJob);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/background-jobs requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/background-jobs",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/background-jobs returns jobs list for authenticated user", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/background-jobs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ jobs: [sampleJob] });
    expect(mockListUserBackgroundJobs).toHaveBeenCalledWith("u-teacher");
    await app.close();
  });

  it("GET /api/background-jobs/:id/download serves export artifact", async () => {
    mockGetUserBackgroundJob.mockResolvedValueOnce({ ...sampleJob, moduleId: "students" });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/background-jobs/job-1/download",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="contacts.csv"');
    expect(res.body).toBe("id,name\n1,Ali");
    expect(mockGetExportArtifact).toHaveBeenCalledWith("u-teacher", "job-1");
    await app.close();
  });

  it("GET /api/background-jobs/:id/download denies an artifact from a module the caller cannot export", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/background-jobs/job-1/download",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      type: "forbidden",
      code: "PERMISSION_DENIED",
      moduleId: "contacts",
    });
    expect(mockGetExportArtifact).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/background-jobs/:id returns single job detail", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/background-jobs/job-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ job: sampleJob });
    expect(mockGetUserBackgroundJob).toHaveBeenCalledWith("u-teacher", "job-1");
    await app.close();
  });

  it("PUT /api/background-jobs/:id updates job configuration", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/background-jobs/job-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(sampleJob),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ job: sampleJob });
    expect(mockUpsertUserBackgroundJob).toHaveBeenCalledWith("u-teacher", sampleJob);
    await app.close();
  });

  it("DELETE /api/background-jobs/:id dismisses job and deletes artifact", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/background-jobs/job-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockDismissUserBackgroundJob).toHaveBeenCalledWith("u-teacher", "job-1");
    expect(mockDeleteExportArtifact).toHaveBeenCalledWith("u-teacher", "job-1");
    await app.close();
  });

  it("POST /api/background-jobs/clear-finished removes finished jobs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/background-jobs/clear-finished",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, removed: 1 });
    expect(mockClearFinishedUserBackgroundJobs).toHaveBeenCalledWith("u-teacher");
    expect(mockDeleteExportArtifacts).toHaveBeenCalledWith("u-teacher", ["job-1"]);
    await app.close();
  });
});
