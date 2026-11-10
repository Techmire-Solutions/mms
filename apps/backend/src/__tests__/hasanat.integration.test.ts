import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, assistantTeacherToken, viewerToken } from "./helpers/tokens.js";
import { ConflictError, PolicyViolationError } from "../lib/httpErrors.js";

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
const mockLoadRedemptions = vi.fn();
const mockRedeemCard = vi.fn();
const mockBatchAward = vi.fn();
const mockDeleteDistribution = vi.fn();

vi.mock("../hasanat/use-cases/hasanatUseCases.js", () => ({
  hasanatUseCases: {
    loadDenoms: vi.fn().mockResolvedValue({ denoms: [], total: 0 }),
    upsertDenoms: vi.fn(),
    loadBatches: vi.fn().mockResolvedValue({ batches: [], total: 0, hasMore: false }),
    upsertBatches: vi.fn(),
    loadDistributions: vi.fn().mockResolvedValue([]),
    loadRedemptions: (...args: unknown[]) => mockLoadRedemptions(...args),
    deleteDistributionById: (...args: unknown[]) => mockDeleteDistribution(...args),
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
    changeDistributionStatus: vi.fn(),
    redeemCard: (...args: unknown[]) => mockRedeemCard(...args),
    voidRedemption: vi.fn(),
    batchAward: (...args: unknown[]) => mockBatchAward(...args),
    batchRecipients: vi.fn().mockResolvedValue({
      recipients: [],
      count: 0,
      stockRemaining: null,
      quotaRemaining: null,
      requiresJob: false,
    }),
    getStudentSummary: vi.fn(),
    getStudentReport: vi.fn().mockResolvedValue({ rows: [], tiers: [] }),
    reconcileTiers: vi.fn(),
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

  it("issues a card through the strict create body and updates it with an OCC token", async () => {
    const createBody = {
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
    };
    const issued = { ...createBody, id: "d-1", status: "active" };
    mockCreateDistribution.mockResolvedValueOnce(issued);
    mockUpdateDistributionById.mockResolvedValueOnce({ ...issued, status: "redeemed" });
    const app = await buildApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: createBody,
    });
    expect(created.statusCode).toBe(201);
    expect(mockCreateDistribution).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "batch-1", quantity: 1 }),
    );

    const updated = await app.inject({
      method: "PUT",
      url: "/api/hasanat/distributions/d-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { reason: "Corrected reason", expectedVersion: 0 },
    });
    expect(updated.statusCode).toBe(200);
    expect(mockUpdateDistributionById).toHaveBeenCalledWith(
      "d-1",
      expect.objectContaining({ reason: "Corrected reason", expectedVersion: 0 }),
    );
    await app.close();
  });

  it("rejects a client-supplied status on create", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: {
        batchId: "batch-1",
        denominationId: "den-1",
        quantity: 1,
        issuedDate: "2026-09-01",
        status: "redeemed",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(mockCreateDistribution).not.toHaveBeenCalled();
    await app.close();
  });

  it("no longer exposes the unguarded bulk write paths", async () => {
    const app = await buildApp();
    for (const [method, url] of [
      ["PUT", "/api/hasanat/distributions/bulk"],
      ["PUT", "/api/hasanat/redemptions/bulk"],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${adminToken(app)}`,
        },
        payload: [],
      });
      // `PUT /distributions/bulk` now falls through to `PUT /distributions/:id` (id="bulk") and
      // fails schema validation; nothing is written either way.
      expect([400, 404, 405]).toContain(response.statusCode);
    }
    expect(mockUpdateDistributionById).not.toHaveBeenCalled();
    await app.close();
  });
});
describe("hasanat route hardening", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const auth = (app: Awaited<ReturnType<typeof buildApp>>) => ({
    host: "demo.localhost",
    authorization: `Bearer ${adminToken(app)}`,
  });

  it("rejects an over-long path param before the use case runs", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/hasanat/distributions/${"x".repeat(65)}`,
      headers: auth(app),
      payload: { reason: "typo", expectedVersion: 0 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("validation_error");
    expect(mockUpdateDistributionById).not.toHaveBeenCalled();
    await app.close();
  });

  it("caps the ledger page size and validates the date filters", async () => {
    const app = await buildApp();

    const tooBig = await app.inject({
      method: "GET",
      url: "/api/hasanat/redemptions?limit=500",
      headers: auth(app),
    });
    expect(tooBig.statusCode).toBe(400);

    const badDate = await app.inject({
      method: "GET",
      url: "/api/hasanat/redemptions?from=not-a-date",
      headers: auth(app),
    });
    expect(badDate.statusCode).toBe(400);

    mockLoadRedemptions.mockResolvedValueOnce({
      redemptions: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    const ok = await app.inject({
      method: "GET",
      url: "/api/hasanat/redemptions?kind=reversal",
      headers: auth(app),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ redemptions: [], total: 0, hasMore: false });
    expect(mockLoadRedemptions).toHaveBeenCalledWith(expect.objectContaining({ kind: "reversal" }));
    await app.close();
  });

  it("validates the batch recipient target and student report dates", async () => {
    const app = await buildApp();

    const noTarget = await app.inject({
      method: "GET",
      url: "/api/hasanat/distributions/batch/recipients",
      headers: auth(app),
    });
    expect(noTarget.statusCode).toBe(400);

    const badRange = await app.inject({
      method: "GET",
      url: "/api/hasanat/reports/students?from=yesterday",
      headers: auth(app),
    });
    expect(badRange.statusCode).toBe(400);
    await app.close();
  });

  it("maps typed domain errors to 409/422 with details", async () => {
    const app = await buildApp();

    mockCreateDistribution.mockRejectedValueOnce(
      new ConflictError("Daily awarding limit reached (5 cards).", "quota_exceeded", {
        used: 5,
        limit: 5,
      }),
    );
    const quota = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions",
      headers: auth(app),
      payload: {
        batchId: "b1",
        denominationId: "d1",
        quantity: 1,
        issuedDate: "2026-11-10",
      },
    });
    expect(quota.statusCode).toBe(409);
    expect(quota.json()).toMatchObject({
      type: "quota_exceeded",
      details: { used: 5, limit: 5 },
    });

    mockRedeemCard.mockRejectedValueOnce(
      new PolicyViolationError(
        "This card must be redeemed in full (50 points); partial redemption is not supported.",
        "value_mismatch",
        { code: "value_mismatch" },
      ),
    );
    const partial = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions/hd1/redeem",
      headers: auth(app),
      payload: { reward: "Book", pointsUsed: 20, date: "2026-11-10" },
    });
    expect(partial.statusCode).toBe(422);
    expect(partial.json().type).toBe("value_mismatch");

    mockBatchAward.mockRejectedValueOnce(
      new ConflictError("No active students match this batch target.", "empty_batch_target"),
    );
    const emptyBatch = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions/batch",
      headers: auth(app),
      payload: {
        batchId: "b1",
        denominationId: "d1",
        target: { kind: "class", sessionId: "s1", classId: "c1" },
        reason: "Weekly halaqa",
        issuedDate: "2026-11-10",
        clientRequestId: "req-abcdefgh",
      },
    });
    expect(emptyBatch.statusCode).toBe(409);
    expect(emptyBatch.json().type).toBe("empty_batch_target");
    await app.close();
  });

  it("returns a typed envelope when a card is already archived", async () => {
    const app = await buildApp();
    mockDeleteDistribution.mockResolvedValueOnce(false);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/hasanat/distributions/hd1",
      headers: auth(app),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "not_found" });
    await app.close();
  });
});
