import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, assistantTeacherToken, viewerToken } from "./helpers/tokens.js";

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

const mockLoadHasanatReportAggregates = vi.fn();
const mockLoadDistributionsPage = vi.fn();
const mockLoadHasanatCommandMetrics = vi.fn();
const mockCreateDistribution = vi.fn();
const mockUpdateDistributionById = vi.fn();

vi.mock("../hasanat/use-cases/hasanatUseCases.js", () => ({
  hasanatUseCases: {
    loadDenoms: vi.fn().mockResolvedValue([]),
    upsertDenoms: vi.fn(),
    loadBatches: vi.fn().mockResolvedValue([]),
    upsertBatches: vi.fn(),
    loadDistributions: vi.fn().mockResolvedValue([]),
    upsertDistributions: vi.fn(),
    loadRedemptions: vi.fn().mockResolvedValue([]),
    upsertRedemptions: vi.fn(),
    deleteDistributionById: vi.fn(),
    restoreDistributionById: vi.fn(),
    bulkSoftDeleteDistributions: vi.fn(),
    bulkRestoreDistributions: vi.fn(),
    loadDistributionsPage: (...args: unknown[]) => mockLoadDistributionsPage(...args),
    createDistribution: (...args: unknown[]) => mockCreateDistribution(...args),
    updateDistributionById: (...args: unknown[]) => mockUpdateDistributionById(...args),
    loadHasanatReportAggregates: (...args: unknown[]) => mockLoadHasanatReportAggregates(...args),
    loadHasanatCommandMetrics: (...args: unknown[]) => mockLoadHasanatCommandMetrics(...args),
    loadHasanatWidgetAggregates: vi.fn().mockResolvedValue({}),
    replaceDenoms: vi.fn(),
    replaceBatches: vi.fn(),
    replaceDistributions: vi.fn(),
    replaceRedemptions: vi.fn(),
  },
}));

describe("hasanat report-aggregates REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadHasanatReportAggregates.mockReset().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/hasanat/report-aggregates loads comparison for authorized roles", async () => {
    mockLoadHasanatReportAggregates.mockResolvedValueOnce({
      comparison: {
        sessions: [{ sessionId: "s1", hasanat: 250 }],
        monthly: {
          a: [{ monthKey: "2026-01", points: 100 }],
          b: [{ monthKey: "2026-04", points: 150 }],
        },
      },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/report-aggregates?sessionIds=s1,s2&rangeAFrom=2026-01-01&rangeATo=2026-03-31&rangeBFrom=2026-04-01&rangeBTo=2026-06-30",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadHasanatReportAggregates).toHaveBeenCalledWith({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
      rangeBFrom: "2026-04-01",
      rangeBTo: "2026-06-30",
    });
    expect(res.json().comparison?.sessions?.[0]?.hasanat).toBe(250);
    await app.close();
  });

  it("GET /api/hasanat/report-aggregates returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/report-aggregates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadHasanatReportAggregates).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("hasanat distributions pagination", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadDistributionsPage.mockReset().mockResolvedValue({
      distributions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    mockCreateDistribution.mockReset();
    mockUpdateDistributionById.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/hasanat/distributions returns paginated shape and forwards filters", async () => {
    mockLoadDistributionsPage.mockResolvedValueOnce({
      distributions: [{ id: "d-1", recipientName: "Ali", status: "active" }],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/distributions?page=1&limit=10&search=ali&status=active",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      distributions: [{ id: "d-1", recipientName: "Ali", status: "active" }],
      total: 1,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    expect(mockLoadDistributionsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        search: "ali",
        status: "active",
        includeDeleted: false,
      }),
    );
    await app.close();
  });

  it("includeDeleted=true forwards deleted-only request for admins", async () => {
    mockLoadDistributionsPage.mockResolvedValueOnce({
      distributions: [
        { id: "d-2", recipientName: "Archived", deletedAt: "2026-07-27T12:00:00.000Z" },
      ],
      total: 1,
      page: 1,
      limit: 15,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/distributions?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadDistributionsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    expect(typeof res.json().distributions[0]?.deletedAt).toBe("string");
    expect(res.json().distributions[0]?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });

  it("forbids includeDeleted for roles without delete access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/distributions?page=1&includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${assistantTeacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadDistributionsPage).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates and updates one distribution without replacing the collection", async () => {
    const distribution = {
      id: "d-1",
      batchId: "batch-1",
      denominationId: "den-1",
      denominationName: "Gold",
      recipientType: "student",
      recipientStudentId: "student-1",
      recipientName: "Ali",
      recipientClass: "Class A",
      quantity: 1,
      reason: "Good work",
      issuedDate: "2026-09-01",
      status: "active",
    };
    mockCreateDistribution.mockResolvedValueOnce(distribution);
    mockUpdateDistributionById.mockResolvedValueOnce({ ...distribution, status: "redeemed" });
    const app = await buildApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: distribution,
    });
    expect(created.statusCode).toBe(201);
    expect(mockCreateDistribution).toHaveBeenCalledWith(distribution);

    const updatedPayload = { ...distribution, status: "redeemed" };
    const updated = await app.inject({
      method: "PUT",
      url: "/api/hasanat/distributions/d-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: updatedPayload,
    });
    expect(updated.statusCode).toBe(200);
    expect(mockUpdateDistributionById).toHaveBeenCalledWith("d-1", updatedPayload);
    await app.close();
  });
});

describe("hasanat metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadHasanatCommandMetrics.mockReset().mockResolvedValue({
      totalStock: 100,
      available: 40,
      distributed: 60,
      redeemed: 20,
      active: 30,
      returned: 10,
      denominations: 5,
      totalPointsDistributed: 300,
      pointsThisWeek: 120,
      pointsLastWeek: 80,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/hasanat/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        totalStock: 100,
        available: 40,
        distributed: 60,
        redeemed: 20,
        active: 30,
        returned: 10,
        denominations: 5,
        totalPointsDistributed: 300,
        pointsThisWeek: 120,
        pointsLastWeek: 80,
      },
    });
    expect(mockLoadHasanatCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/hasanat/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/hasanat/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${viewerToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadHasanatCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});
