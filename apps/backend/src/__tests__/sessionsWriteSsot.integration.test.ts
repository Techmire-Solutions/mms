import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, viewerToken } from "./helpers/tokens.js";

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

const mockBulkUpdateSessionsStatus = vi.fn();
const mockCreateSession = vi.fn();
const mockUpdateSessionById = vi.fn();
const mockDeleteSessionById = vi.fn();
const mockRestoreSessionById = vi.fn();
const mockBulkSoftDeleteSessions = vi.fn();
const mockBulkRestoreSessions = vi.fn();
const mockLoadSessionsPage = vi.fn();

vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: {
    bulkUpdateSessionsStatus: (...args: unknown[]) => mockBulkUpdateSessionsStatus(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    updateSessionById: (...args: unknown[]) => mockUpdateSessionById(...args),
    deleteSessionById: (...args: unknown[]) => mockDeleteSessionById(...args),
    restoreSessionById: (...args: unknown[]) => mockRestoreSessionById(...args),
    bulkSoftDeleteSessions: (...args: unknown[]) => mockBulkSoftDeleteSessions(...args),
    bulkRestoreSessions: (...args: unknown[]) => mockBulkRestoreSessions(...args),
    loadSessionsPage: (...args: unknown[]) => mockLoadSessionsPage(...args),
    countSessions: vi.fn().mockResolvedValue(0),
    loadSessionsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadSessionsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadSessionsReportAggregates: vi
      .fn()
      .mockResolvedValue({ capacity: [], enrollmentTrends: [], todaysSessions: [] }),
    loadSessions: vi.fn().mockResolvedValue([]),
  },
}));

describe("sessions API & bulk status write integration tests", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("POST /api/sessions/bulk-status denies unauthenticated request", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: { host: "demo.localhost" },
      payload: { ids: ["sess-1"], status: "completed" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("POST /api/sessions/bulk-status denies viewer role (write forbidden)", async () => {
    const app = await buildApp();
    const token = viewerToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { ids: ["sess-1"], status: "completed" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("POST /api/sessions/bulk-status validates schema (rejects empty ids)", async () => {
    const app = await buildApp();
    const token = adminToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { ids: [], status: "completed" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST /api/sessions/bulk-status allows admin and returns result", async () => {
    mockBulkUpdateSessionsStatus.mockResolvedValueOnce({ succeeded: 2, failed: 0 });

    const app = await buildApp();
    const token = adminToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { ids: ["sess-1", "sess-2"], status: "completed" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkUpdateSessionsStatus).toHaveBeenCalledWith(["sess-1", "sess-2"], "completed");
  });
});
