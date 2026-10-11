import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, auditorToken, teacherToken } from "./helpers/tokens.js";

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

const mockLoadObligationsCommandMetrics = vi.fn();
const mockLoadObligationCollections = vi.fn();
const mockReplaceMujtahidReps = vi.fn();

vi.mock("../obligations/use-cases/obligationsUseCases.js", () => ({
  obligationsUseCases: {
    loadObligationTypes: vi.fn().mockResolvedValue([]),
    upsertObligationTypes: vi.fn(),
    loadMujtahids: vi.fn().mockResolvedValue([]),
    upsertMujtahids: vi.fn(),
    loadMujtahidReps: vi.fn().mockResolvedValue([]),
    upsertMujtahidReps: vi.fn(),
    loadWakalaTypes: vi.fn().mockResolvedValue([]),
    upsertWakalaTypes: vi.fn(),
    loadObligationDistributions: vi.fn().mockResolvedValue([]),
    upsertObligationDistributions: vi.fn(),
    loadObligationCollections: (...args: unknown[]) => mockLoadObligationCollections(...args),
    upsertObligationCollections: vi.fn(),
    deleteObligationCollectionById: vi.fn(),
    restoreObligationCollectionById: vi.fn(),
    bulkSoftDeleteObligationCollections: vi.fn(),
    bulkRestoreObligationCollections: vi.fn(),
    loadObligationsCommandMetrics: (...args: unknown[]) =>
      mockLoadObligationsCommandMetrics(...args),
    loadObligationsReportAggregates: vi.fn().mockResolvedValue({}),
    replaceObligationTypes: vi.fn(),
    replaceMujtahids: vi.fn(),
    replaceMujtahidReps: (...args: unknown[]) => mockReplaceMujtahidReps(...args),
    replaceWakalaTypes: vi.fn(),
    replaceObligationDistributions: vi.fn(),
    replaceObligationCollections: vi.fn(),
  },
}));

describe("obligations metrics REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockLoadObligationsCommandMetrics.mockReset().mockResolvedValue({
      total: 2,
      totalAmount: 250,
      cash: 1,
      online: 1,
      newThisPeriod: 1,
      obligationTypes: 3,
    });
    mockLoadObligationCollections.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/obligations/metrics loads SQL metrics for authorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      metrics: {
        total: 2,
        totalAmount: 250,
        cash: 1,
        online: 1,
        newThisPeriod: 1,
        obligationTypes: 3,
      },
    });
    expect(mockLoadObligationsCommandMetrics).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/obligations/metrics returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationsCommandMetrics).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("obligations collections contract REST", () => {
  it("GET /api/obligations/collections allows authorized roles with read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadObligationCollections).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
    await app.close();
  });

  it("GET /api/obligations/collections?includeDeleted=true returns 403 for roles without delete permissions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${auditorToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationCollections).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/obligations/collections?includeDeleted=true succeeds for admin with delete permissions", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadObligationCollections).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("GET /api/obligations/collections returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/obligations/collections",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadObligationCollections).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("obligations reps bulk replace REST", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockReplaceMujtahidReps.mockReset();
    mockReplaceMujtahidReps.mockImplementation(async (reps) => reps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/obligations/reps/bulk invokes replaceMujtahidReps and returns updated reps", async () => {
    const app = await buildApp();
    const payload = [{ id: "mr1", name: "Remaining Rep", mujtahid_id: "m1" }];
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/reps/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(mockReplaceMujtahidReps).toHaveBeenCalledWith(payload);
    expect(res.json()).toEqual({ reps: payload });
    await app.close();
  });

  it("PUT /api/obligations/reps/bulk returns 403 for unauthorized roles", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/obligations/reps/bulk",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${teacherToken(app)}`,
      },
      payload: [],
    });
    expect(res.statusCode).toBe(403);
    expect(mockReplaceMujtahidReps).not.toHaveBeenCalled();
    await app.close();
  });
});
