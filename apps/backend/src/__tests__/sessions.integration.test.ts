import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const mockLoadSessions = vi.fn();
const mockLoadSessionsPage = vi.fn();
const mockLoadSessionsWidgetAggregates = vi.fn();
const mockLoadSessionsReportAggregates = vi.fn();

vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: {
    loadSessions: (...args: unknown[]) => mockLoadSessions(...args),
    loadSessionsPage: (...args: unknown[]) => mockLoadSessionsPage(...args),
    loadSessionsWidgetAggregates: (...args: unknown[]) => mockLoadSessionsWidgetAggregates(...args),
    loadSessionsReportAggregates: (...args: unknown[]) => mockLoadSessionsReportAggregates(...args),
    countSessions: vi.fn().mockResolvedValue(0),
    loadSessionsCommandMetrics: vi.fn().mockResolvedValue({}),
    updateSessionById: vi.fn(),
    deleteSessionById: vi.fn(),
    restoreSessionById: vi.fn(),
    createSession: vi.fn(),
    bulkSoftDeleteSessions: vi.fn(),
    bulkUpdateSessionsStatus: vi.fn(),
    bulkRestoreSessions: vi.fn(),
  },
}));

describe("sessions REST routes integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadSessions.mockReset().mockResolvedValue([]);
    mockLoadSessionsPage.mockReset().mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    mockLoadSessionsWidgetAggregates.mockReset().mockResolvedValue({
      w1: { value: 5, totalCount: 5, chartData: [{ name: "active", value: 3 }] },
    });
    mockLoadSessionsReportAggregates.mockReset().mockResolvedValue({
      capacity: [],
      enrollmentTrends: [],
      todaysSessions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/sessions requires auth header", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sessions",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/sessions returns sessions list for authorized admin", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sessions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app, { name: "Admin User" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    await app.close();
  });

  it("POST /api/sessions/widget-aggregates loads aggregates for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/widget-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        widgets: [{ id: "w1", operation: "count", xAxisField: "status" }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: {
        w1: { value: 5, totalCount: 5, chartData: [{ name: "active", value: 3 }] },
      },
    });
    expect(mockLoadSessionsWidgetAggregates).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "w1", operation: "count", xAxisField: "status" })],
      expect.anything(),
    );
    await app.close();
  });

  it("POST /api/sessions/widget-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/widget-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
        "content-type": "application/json",
      },
      payload: {
        widgets: [{ id: "w1", operation: "count" }],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadSessionsWidgetAggregates).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/sessions/report-aggregates loads aggregates for authorized roles", async () => {
    mockLoadSessionsReportAggregates.mockResolvedValue({
      capacity: [
        {
          sessionId: "sess-1",
          classId: "c1",
          session: "Morning",
          class: "A",
          enrolled: 5,
          capacity: 10,
          rate: 50,
          status: "active",
        },
      ],
      enrollmentTrends: [{ monthKey: "2026-01", students: 3, sessionName: "Morning" }],
      todaysSessions: [],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sessions/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      capacity: [
        {
          sessionId: "sess-1",
          classId: "c1",
          session: "Morning",
          class: "A",
          enrolled: 5,
          capacity: 10,
          rate: 50,
          status: "active",
        },
      ],
      enrollmentTrends: [{ monthKey: "2026-01", students: 3, sessionName: "Morning" }],
      todaysSessions: [],
    });
    expect(mockLoadSessionsReportAggregates).toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/sessions/import is registered (401 without a token, not 404)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/import",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { rows: [{ name: "Imported" }] },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/sessions/export/csv is registered (401 without a token, not 404)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/export/csv",
      headers: { host: "demo.localhost", "content-type": "application/json" },
      payload: { query: {} },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/sessions/export-audit is not served (queue path owns export audit)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/export-audit",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { count: 3, scope: "filtered" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("POST /api/sessions/bulk-status rejects an unknown status", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: ["s1"], status: "not_a_lifecycle_state" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("POST /api/sessions/bulk-status rejects more than 500 ids", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions/bulk-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
        "content-type": "application/json",
      },
      payload: { ids: Array.from({ length: 501 }, (_, i) => `s${i}`), status: "open" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("GET /api/sessions/report-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/sessions/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockLoadSessionsReportAggregates).not.toHaveBeenCalled();
    await app.close();
  });
});
