import { describe, expect, it, vi } from "vitest";
import type { ObligationsRepository } from "../obligations/repository/obligationsRepository.js";

/**
 * The three factories extracted from `obligationsUseCases` / `obligationsCatalogUseCases` to keep
 * those files under the 300-line ceiling. Each must bind the *right* repository method — a mistyped
 * binding would swap two catalogues or broadcast the wrong collection key, which no other test
 * would catch because the composition root only spreads the returned objects.
 */
const mockTenant = vi.hoisted(() => ({ getRequestTenant: vi.fn((): string | null => "demo") }));
vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, getRequestTenant: mockTenant.getRequestTenant };
});

import { createObligationCollectionBulkService } from "../obligations/use-cases/obligationCollectionServices.js";
import { createObligationsCatalogServices } from "../obligations/use-cases/obligationsCatalogServices.js";
import { createObligationsInsightUseCases } from "../obligations/use-cases/obligationsInsightUseCases.js";

function fakeRepo() {
  return {
    listObligationCollectionsByWorkspace: vi.fn().mockResolvedValue([]),
    replaceObligationCollectionsForWorkspace: vi.fn().mockResolvedValue([]),
    listObligationTypesByWorkspace: vi.fn().mockResolvedValue([{ id: "ot-1" }]),
    replaceObligationTypesForWorkspace: vi.fn().mockResolvedValue([]),
    listMujtahidsByWorkspace: vi.fn().mockResolvedValue([]),
    replaceMujtahidsForWorkspace: vi.fn().mockResolvedValue([]),
    listMujtahidRepsByWorkspace: vi.fn().mockResolvedValue([]),
    replaceMujtahidRepsForWorkspace: vi.fn().mockResolvedValue([]),
    listWakalaTypesByWorkspace: vi.fn().mockResolvedValue([]),
    replaceWakalaTypesForWorkspace: vi.fn().mockResolvedValue([]),
    listObligationDistributionsByWorkspace: vi.fn().mockResolvedValue([]),
    replaceObligationDistributionsForWorkspace: vi.fn().mockResolvedValue([]),
    aggregateObligationsCommandMetrics: vi
      .fn()
      .mockResolvedValue({ total: 1, totalAmount: 100, cash: 100, online: 0 }),
    aggregateObligationsReport: vi.fn().mockResolvedValue({ totalCollections: 2 }),
  } as unknown as ObligationsRepository;
}

describe("obligations use-case composition", () => {
  it("insight use cases delegate to the repository aggregates", async () => {
    const repo = fakeRepo();
    const insight = createObligationsInsightUseCases(repo);

    await expect(insight.loadObligationsCommandMetrics()).resolves.toMatchObject({ total: 1 });
    await expect(
      insight.loadObligationsReportAggregates({ typeId: "ot-1" }),
    ).resolves.toMatchObject({ totalCollections: 2 });
    expect(
      (repo as unknown as { aggregateObligationsReport: ReturnType<typeof vi.fn> })
        .aggregateObligationsReport,
    ).toHaveBeenCalledWith("demo", { typeId: "ot-1" });
  });

  it("insight use cases return empty shapes without a tenant", async () => {
    mockTenant.getRequestTenant.mockReturnValueOnce(null).mockReturnValueOnce(null);
    const insight = createObligationsInsightUseCases(fakeRepo());

    await expect(insight.loadObligationsCommandMetrics()).resolves.toMatchObject({ total: 0 });
    await expect(insight.loadObligationsReportAggregates()).resolves.toMatchObject({
      totalCollections: 0,
      typeBreakdown: [],
    });
  });

  it("the collection bulk service binds the collections repository methods", async () => {
    const repo = fakeRepo() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    const service = createObligationCollectionBulkService(repo as unknown as ObligationsRepository);

    await service.load();
    expect(repo.listObligationCollectionsByWorkspace).toHaveBeenCalled();
    expect(repo.replaceObligationCollectionsForWorkspace).not.toHaveBeenCalled();
  });

  it("each catalogue service binds its own repository pair", async () => {
    const repo = fakeRepo() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    const services = createObligationsCatalogServices(repo as unknown as ObligationsRepository);

    expect(await services.obligationTypeService.load()).toEqual([{ id: "ot-1" }]);
    expect(repo.listObligationTypesByWorkspace).toHaveBeenCalled();
    // A swapped binding would call another catalogue's list method instead.
    expect(repo.listMujtahidsByWorkspace).not.toHaveBeenCalled();
    expect(repo.listWakalaTypesByWorkspace).not.toHaveBeenCalled();
  });
});
