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

const mockLoadSessionsPage = vi.fn();
const mockDeleteSessionById = vi.fn();
const mockRestoreSessionById = vi.fn();
const mockBulkSoftDeleteSessions = vi.fn();
const mockBulkRestoreSessions = vi.fn();
const mockCreateSession = vi.fn();

vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: {
    loadSessionsPage: (...args: unknown[]) => mockLoadSessionsPage(...args),
    deleteSessionById: (...args: unknown[]) => mockDeleteSessionById(...args),
    restoreSessionById: (...args: unknown[]) => mockRestoreSessionById(...args),
    bulkSoftDeleteSessions: (...args: unknown[]) => mockBulkSoftDeleteSessions(...args),
    bulkRestoreSessions: (...args: unknown[]) => mockBulkRestoreSessions(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    countSessions: vi.fn().mockResolvedValue(0),
    loadSessionsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadSessionsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadSessionsReportAggregates: vi
      .fn()
      .mockResolvedValue({ capacity: [], enrollmentTrends: [], todaysSessions: [] }),
    updateSessionById: vi.fn(),
    bulkUpdateSessionsStatus: vi.fn(),
    loadSessions: vi.fn().mockResolvedValue([]),
  },
}));

describe("sessions soft delete routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("DELETE /api/sessions/:id soft-deletes session", async () => {
    mockDeleteSessionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sessions/s1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Ended early" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteSessionById).toHaveBeenCalledWith("s1", "u-admin", "Ended early");
    await app.close();
  });

  it("POST /api/sessions/:id/restore restores a session", async () => {
    mockRestoreSessionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/s1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreSessionById).toHaveBeenCalledWith("s1", "u-admin");
    await app.close();
  });

  it("GET /api/sessions lists with includeDeleted options", async () => {
    mockLoadSessionsPage.mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sessions?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadSessionsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("POST /api/sessions creates without client id", async () => {
    mockCreateSession.mockResolvedValue({
      id: "sess-1",
      name: "Morning Hifz",
      type: "Hifz",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: 1000,
      currency: "PKR",
      classes: [],
      timetable: [],
      discounts: [],
      events: [],
      tabarruk: [],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: {
        name: "Morning Hifz",
        type: "Hifz",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        baseFee: 1000,
        currency: "PKR",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(mockCreateSession).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/sessions/bulk-delete soft-deletes multiple sessions", async () => {
    mockBulkSoftDeleteSessions.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-delete",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["s1", "s2"], deletionReason: "Bulk archive" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkSoftDeleteSessions).toHaveBeenCalledWith(
      ["s1", "s2"],
      "u-admin",
      "Bulk archive",
    );
    await app.close();
  });

  it("POST /api/sessions/bulk-restore restores multiple sessions", async () => {
    mockBulkRestoreSessions.mockResolvedValue({ succeeded: 2, failed: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { ids: ["s1", "s2"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, succeeded: 2, failed: 0 });
    expect(mockBulkRestoreSessions).toHaveBeenCalledWith(["s1", "s2"], "u-admin");
    await app.close();
  });
});
