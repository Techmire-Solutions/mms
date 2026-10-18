import { describe, expect, it, vi } from "vitest";
import { createHasanatUseCases } from "../hasanat/use-cases/hasanatUseCases.js";
import type { HasanatRepository } from "../hasanat/repository/hasanatRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

function createFakeRepo(): HasanatRepository {
  return {
    listDenomsByWorkspace: vi.fn().mockResolvedValue([]),
    findDenomById: vi.fn().mockResolvedValue(null),
    findDenomsByIds: vi.fn().mockResolvedValue([]),
    saveDenom: vi.fn().mockResolvedValue(undefined),
    bulkSaveDenoms: vi.fn().mockResolvedValue(undefined),
    replaceDenomsForWorkspace: vi.fn().mockResolvedValue(undefined),

    listBatchesByWorkspace: vi.fn().mockResolvedValue([]),
    findBatchById: vi.fn().mockResolvedValue(null),
    findBatchesByIds: vi.fn().mockResolvedValue([]),
    saveBatch: vi.fn().mockResolvedValue(undefined),
    bulkSaveBatches: vi.fn().mockResolvedValue(undefined),
    replaceBatchesForWorkspace: vi.fn().mockResolvedValue(undefined),

    listDistributionsByWorkspace: vi.fn().mockResolvedValue([]),
    findDistributionById: vi.fn().mockResolvedValue(null),
    findDistributionsByIds: vi.fn().mockResolvedValue([]),
    saveDistribution: vi.fn().mockResolvedValue(undefined),
    bulkSaveDistributions: vi.fn().mockResolvedValue(undefined),
    replaceDistributionsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listDistributionsPage: vi.fn().mockResolvedValue({
      distributions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),

    listRedemptionsByWorkspace: vi.fn().mockResolvedValue([]),
    findRedemptionById: vi.fn().mockResolvedValue(null),
    findRedemptionsByIds: vi.fn().mockResolvedValue([]),
    saveRedemption: vi.fn().mockResolvedValue(undefined),
    bulkSaveRedemptions: vi.fn().mockResolvedValue(undefined),
    replaceRedemptionsForWorkspace: vi.fn().mockResolvedValue(undefined),

    aggregateHasanatCommandMetrics: vi.fn().mockResolvedValue({
      totalStock: 10,
      available: 6,
      distributed: 3,
      redeemed: 1,
      active: 2,
      returned: 0,
      denominations: 4,
      totalPointsDistributed: 0,
      pointsThisWeek: 0,
      pointsLastWeek: 0,
    }),
    aggregateHasanatWidgetQueries: vi.fn().mockResolvedValue({}),
    loadHasanatReportAggregates: vi.fn().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    }),
  };
}

describe("hasanat use-cases (DI with fake repository)", () => {
  it("loadDistributionsPage delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createHasanatUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadDistributionsPage({ page: 2, limit: 15 }),
    );

    expect(result).toEqual({ distributions: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(repo.listDistributionsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 15 });
  });

  it("loadHasanatCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createHasanatUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadHasanatCommandMetrics());

    expect(result.totalStock).toBe(10);
    expect(repo.aggregateHasanatCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("upsertDenoms delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createHasanatUseCases(repo);
    const denom = {
      id: "d-1",
      name: "Star",
      points: 5,
      color: "emerald",
      description: "",
      icon: "Star",
      active: true,
    };

    const result = await runWithTenant("demo", () => useCases.upsertDenoms([denom]));

    expect(result).toEqual([denom]);
    expect(repo.bulkSaveDenoms).toHaveBeenCalledWith("demo", [denom]);
  });

  it("loadDenomById and loadDenomsByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeDenom = {
      id: "d-1",
      name: "Star",
      points: 5,
      color: "emerald",
      description: "",
      icon: "Star",
      active: true,
    };
    (repo.findDenomById as any).mockResolvedValue(fakeDenom);
    (repo.findDenomsByIds as any).mockResolvedValue([fakeDenom]);
    const useCases = createHasanatUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadDenomById("d-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadDenomsByIds(["d-1", "  "]));

    expect(single).toEqual(fakeDenom);
    expect(multiple).toEqual([fakeDenom]);
    expect(repo.findDenomById).toHaveBeenCalledWith("demo", "d-1");
    expect(repo.findDenomsByIds).toHaveBeenCalledWith("demo", ["d-1"]);
  });

  it("loadBatchById and loadBatchesByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeBatch = {
      id: "b-1",
      denominationId: "d-1",
      denominationName: "Star",
      quantity: 100,
      remaining: 80,
      addedDate: "2026-09-01",
      note: "",
    };
    (repo.findBatchById as any).mockResolvedValue(fakeBatch);
    (repo.findBatchesByIds as any).mockResolvedValue([fakeBatch]);
    const useCases = createHasanatUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadBatchById("b-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadBatchesByIds(["b-1", ""]));

    expect(single).toEqual(fakeBatch);
    expect(multiple).toEqual([fakeBatch]);
    expect(repo.findBatchById).toHaveBeenCalledWith("demo", "b-1");
    expect(repo.findBatchesByIds).toHaveBeenCalledWith("demo", ["b-1"]);
  });

  it("loadRedemptionById and loadRedemptionsByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeRedemption = {
      id: "r-1",
      distributionId: "dist-1",
      studentName: "Alice",
      reward: "Book",
      pointsUsed: 50,
      date: "2026-09-01",
    };
    (repo.findRedemptionById as any).mockResolvedValue(fakeRedemption);
    (repo.findRedemptionsByIds as any).mockResolvedValue([fakeRedemption]);
    const useCases = createHasanatUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadRedemptionById("r-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadRedemptionsByIds(["r-1"]));

    expect(single).toEqual(fakeRedemption);
    expect(multiple).toEqual([fakeRedemption]);
    expect(repo.findRedemptionById).toHaveBeenCalledWith("demo", "r-1");
    expect(repo.findRedemptionsByIds).toHaveBeenCalledWith("demo", ["r-1"]);
  });

  it("loadDistributionsByIds filters soft-deleted items by default", async () => {
    const repo = createFakeRepo();
    const activeDist = {
      id: "dist-1",
      batchId: "b-1",
      denominationId: "d-1",
      denominationName: "Star",
      recipientType: "student" as const,
      recipientName: "Alice",
      recipientClass: "1A",
      quantity: 1,
      reason: "Good deed",
      issuedDate: "2026-09-01",
      status: "active" as const,
    };
    const deletedDist = { ...activeDist, id: "dist-2", deletedAt: new Date().toISOString() };
    (repo.findDistributionsByIds as any).mockImplementation(
      async (_t: string, _ids: string[], opts?: any) => {
        return opts?.includeDeleted || opts?.deleted === "deleted" ? [deletedDist] : [activeDist];
      },
    );
    const useCases = createHasanatUseCases(repo);

    const activeOnly = await runWithTenant("demo", () =>
      useCases.loadDistributionsByIds(["dist-1", "dist-2"]),
    );
    const archivedOnly = await runWithTenant("demo", () =>
      useCases.loadDistributionsByIds(["dist-1", "dist-2"], true),
    );

    expect(repo.findDistributionsByIds).toHaveBeenCalledWith("demo", ["dist-1", "dist-2"], {
      includeDeleted: false,
    });
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe("dist-1");
    expect(repo.findDistributionsByIds).toHaveBeenCalledWith("demo", ["dist-1", "dist-2"], {
      includeDeleted: true,
    });
    expect(archivedOnly).toHaveLength(1);
    expect(archivedOnly[0].id).toBe("dist-2");
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createHasanatUseCases(repo);

    const page = await useCases.loadDistributionsPage({ page: 1, limit: 15 });
    const metrics = await useCases.loadHasanatCommandMetrics();
    const singleBatch = await useCases.loadBatchById("b-1");
    const batchList = await useCases.loadBatchesByIds(["b-1"]);
    const singleDenom = await useCases.loadDenomById("d-1");
    const denomList = await useCases.loadDenomsByIds(["d-1"]);
    const singleRedemption = await useCases.loadRedemptionById("r-1");
    const redemptionList = await useCases.loadRedemptionsByIds(["r-1"]);

    expect(page).toEqual({ distributions: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(metrics.totalStock).toBe(0);
    expect(singleBatch).toBeNull();
    expect(batchList).toEqual([]);
    expect(singleDenom).toBeNull();
    expect(denomList).toEqual([]);
    expect(singleRedemption).toBeNull();
    expect(redemptionList).toEqual([]);
    expect(repo.listDistributionsPage).not.toHaveBeenCalled();
    expect(repo.aggregateHasanatCommandMetrics).not.toHaveBeenCalled();
  });
});
