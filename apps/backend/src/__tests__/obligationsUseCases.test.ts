import { describe, expect, it, vi } from "vitest";
import { createObligationsUseCases } from "../obligations/use-cases/obligationsUseCases.js";
import type { ObligationsRepository } from "../obligations/repository/obligationsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

function createFakeRepo(): ObligationsRepository {
  return {
    listObligationTypesByWorkspace: vi.fn().mockResolvedValue([]),
    findObligationTypeById: vi.fn().mockResolvedValue(null),
    findObligationTypesByIds: vi.fn().mockResolvedValue([]),
    saveObligationType: vi.fn().mockResolvedValue(undefined),
    bulkSaveObligationTypes: vi.fn().mockResolvedValue(undefined),
    replaceObligationTypesForWorkspace: vi.fn().mockResolvedValue(undefined),

    listMujtahidsByWorkspace: vi.fn().mockResolvedValue([]),
    findMujtahidById: vi.fn().mockResolvedValue(null),
    findMujtahidsByIds: vi.fn().mockResolvedValue([]),
    saveMujtahid: vi.fn().mockResolvedValue(undefined),
    bulkSaveMujtahids: vi.fn().mockResolvedValue(undefined),
    replaceMujtahidsForWorkspace: vi.fn().mockResolvedValue(undefined),

    listMujtahidRepsByWorkspace: vi.fn().mockResolvedValue([]),
    findMujtahidRepById: vi.fn().mockResolvedValue(null),
    findMujtahidRepsByIds: vi.fn().mockResolvedValue([]),
    saveMujtahidRep: vi.fn().mockResolvedValue(undefined),
    bulkSaveMujtahidReps: vi.fn().mockResolvedValue(undefined),
    replaceMujtahidRepsForWorkspace: vi.fn().mockResolvedValue(undefined),

    listWakalaTypesByWorkspace: vi.fn().mockResolvedValue([]),
    findWakalaTypeById: vi.fn().mockResolvedValue(null),
    findWakalaTypesByIds: vi.fn().mockResolvedValue([]),
    saveWakalaType: vi.fn().mockResolvedValue(undefined),
    bulkSaveWakalaTypes: vi.fn().mockResolvedValue(undefined),
    replaceWakalaTypesForWorkspace: vi.fn().mockResolvedValue(undefined),

    listObligationDistributionsByWorkspace: vi.fn().mockResolvedValue([]),
    findObligationDistributionById: vi.fn().mockResolvedValue(null),
    findObligationDistributionsByIds: vi.fn().mockResolvedValue([]),
    saveObligationDistribution: vi.fn().mockResolvedValue(undefined),
    bulkSaveObligationDistributions: vi.fn().mockResolvedValue(undefined),
    replaceObligationDistributionsForWorkspace: vi.fn().mockResolvedValue(undefined),

    listObligationCollectionsByWorkspace: vi.fn().mockResolvedValue([]),
    findObligationCollectionById: vi.fn().mockResolvedValue(null),
    findObligationCollectionsByIds: vi.fn().mockResolvedValue([]),
    saveObligationCollection: vi.fn().mockResolvedValue(undefined),
    bulkSaveObligationCollections: vi.fn().mockResolvedValue(undefined),
    replaceObligationCollectionsForWorkspace: vi.fn().mockResolvedValue(undefined),

    aggregateObligationsCommandMetrics: vi.fn().mockResolvedValue({
      total: 5,
      totalAmount: 100,
      cash: 60,
      online: 40,
      newThisPeriod: 2,
      obligationTypes: 3,
    }),
    aggregateObligationsReport: vi.fn().mockResolvedValue({
      totalCollections: 0,
      totalAmount: 0,
      uniqueReps: 0,
      typeBreakdown: [],
      monthlyTrend: [],
      wakalaSummary: [],
      repSummary: [],
    }),
  };
}

describe("obligations use-cases (DI with fake repository)", () => {
  it("loadObligationCollections delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createObligationsUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadObligationCollections());

    expect(result).toEqual([]);
  });

  it("loadObligationsCommandMetrics delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createObligationsUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadObligationsCommandMetrics());

    expect(result.total).toBe(5);
    expect(repo.aggregateObligationsCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("loadObligationTypeById and loadObligationTypesByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeType = {
      id: "type-1",
      name: "Fitra",
      quantity_based: false,
      designated_for: "Both" as const,
    };
    (repo.findObligationTypeById as any).mockResolvedValue(fakeType);
    (repo.findObligationTypesByIds as any).mockResolvedValue([fakeType]);
    const useCases = createObligationsUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadObligationTypeById("type-1"));
    const multiple = await runWithTenant("demo", () =>
      useCases.loadObligationTypesByIds(["type-1", " "]),
    );

    expect(single).toEqual(fakeType);
    expect(multiple).toEqual([fakeType]);
    expect(repo.findObligationTypeById).toHaveBeenCalledWith("demo", "type-1");
    expect(repo.findObligationTypesByIds).toHaveBeenCalledWith("demo", ["type-1"]);
  });

  it("saveObligationType delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeType = {
      id: "type-1",
      name: "Fitra",
      quantity_based: false,
      designated_for: "Both" as const,
    };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveObligationType(fakeType));

    expect(repo.saveObligationType).toHaveBeenCalledWith("demo", fakeType);
  });

  it("loadMujtahidById and loadMujtahidsByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeMujtahid = { id: "m-1", name: "Ayatollah Sistani" };
    (repo.findMujtahidById as any).mockResolvedValue(fakeMujtahid);
    (repo.findMujtahidsByIds as any).mockResolvedValue([fakeMujtahid]);
    const useCases = createObligationsUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadMujtahidById("m-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadMujtahidsByIds(["m-1", ""]));

    expect(single).toEqual(fakeMujtahid);
    expect(multiple).toEqual([fakeMujtahid]);
    expect(repo.findMujtahidById).toHaveBeenCalledWith("demo", "m-1");
    expect(repo.findMujtahidsByIds).toHaveBeenCalledWith("demo", ["m-1"]);
  });

  it("saveMujtahid delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeMujtahid = { id: "m-1", name: "Ayatollah Sistani" };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveMujtahid(fakeMujtahid));

    expect(repo.saveMujtahid).toHaveBeenCalledWith("demo", fakeMujtahid);
  });

  it("loadMujtahidRepById and loadMujtahidRepsByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeRep = {
      id: "rep-1",
      name: "Sheikh Representative",
      mujtahid_id: "m-1",
      contact_id: "c-1",
    };
    (repo.findMujtahidRepById as any).mockResolvedValue(fakeRep);
    (repo.findMujtahidRepsByIds as any).mockResolvedValue([fakeRep]);
    const useCases = createObligationsUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadMujtahidRepById("rep-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadMujtahidRepsByIds(["rep-1"]));

    expect(single).toEqual(fakeRep);
    expect(multiple).toEqual([fakeRep]);
    expect(repo.findMujtahidRepById).toHaveBeenCalledWith("demo", "rep-1");
    expect(repo.findMujtahidRepsByIds).toHaveBeenCalledWith("demo", ["rep-1"]);
  });

  it("saveMujtahidRep delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeRep = {
      id: "rep-1",
      name: "Sheikh Representative",
      mujtahid_id: "m-1",
      contact_id: "c-1",
    };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveMujtahidRep(fakeRep));

    expect(repo.saveMujtahidRep).toHaveBeenCalledWith("demo", fakeRep);
  });

  it("loadWakalaTypeById and loadWakalaTypesByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeWakala = {
      id: "w-1",
      mujtahid_representative_id: "rep-1",
      obligation_type_id: "type-1",
    };
    (repo.findWakalaTypeById as any).mockResolvedValue(fakeWakala);
    (repo.findWakalaTypesByIds as any).mockResolvedValue([fakeWakala]);
    const useCases = createObligationsUseCases(repo);

    const single = await runWithTenant("demo", () => useCases.loadWakalaTypeById("w-1"));
    const multiple = await runWithTenant("demo", () => useCases.loadWakalaTypesByIds(["w-1"]));

    expect(single).toEqual(fakeWakala);
    expect(multiple).toEqual([fakeWakala]);
    expect(repo.findWakalaTypeById).toHaveBeenCalledWith("demo", "w-1");
    expect(repo.findWakalaTypesByIds).toHaveBeenCalledWith("demo", ["w-1"]);
  });

  it("saveWakalaType delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeWakala = {
      id: "w-1",
      mujtahid_representative_id: "rep-1",
      obligation_type_id: "type-1",
    };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveWakalaType(fakeWakala));

    expect(repo.saveWakalaType).toHaveBeenCalledWith("demo", fakeWakala);
  });

  it("loadObligationDistributionById and loadObligationDistributionsByIds delegate to repository", async () => {
    const repo = createFakeRepo();
    const fakeDist = {
      id: "d-1",
      name: "Half Sahm Imam",
      percentage: 50,
      wakala_type_id: "w-1",
      type: "Income" as const,
    };
    (repo.findObligationDistributionById as any).mockResolvedValue(fakeDist);
    (repo.findObligationDistributionsByIds as any).mockResolvedValue([fakeDist]);
    const useCases = createObligationsUseCases(repo);

    const single = await runWithTenant("demo", () =>
      useCases.loadObligationDistributionById("d-1"),
    );
    const multiple = await runWithTenant("demo", () =>
      useCases.loadObligationDistributionsByIds(["d-1"]),
    );

    expect(single).toEqual(fakeDist);
    expect(multiple).toEqual([fakeDist]);
    expect(repo.findObligationDistributionById).toHaveBeenCalledWith("demo", "d-1");
    expect(repo.findObligationDistributionsByIds).toHaveBeenCalledWith("demo", ["d-1"]);
  });

  it("saveObligationDistribution delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const fakeDist = {
      id: "d-1",
      name: "Half Sahm Imam",
      percentage: 50,
      wakala_type_id: "w-1",
      type: "Income" as const,
    };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveObligationDistribution(fakeDist));

    expect(repo.saveObligationDistribution).toHaveBeenCalledWith("demo", fakeDist);
  });

  it("loadObligationCollectionById handles soft-deleted records correctly", async () => {
    const repo = createFakeRepo();
    const activeCollection = {
      id: "oc-1",
      receipt_no: "REC-001",
      received_date: "2026-09-01",
      sender_id: "c-1",
      reference_id: null,
      amount: 100,
      currency_id: "USD",
      payment_mode: "Cash" as const,
      obligation_type_id: "type-1",
      mujtahid_representative_id: "rep-1",
      received_by: "u-1",
    };
    const deletedCollection = {
      ...activeCollection,
      id: "oc-2",
      deletedAt: "2026-09-02T00:00:00.000Z",
    };

    (repo.findObligationCollectionById as any).mockImplementation((_tenant: string, id: string) => {
      if (id === "oc-1") return Promise.resolve(activeCollection);
      if (id === "oc-2") return Promise.resolve(deletedCollection);
      return Promise.resolve(null);
    });

    const useCases = createObligationsUseCases(repo);

    // Active lookup
    const active = await runWithTenant("demo", () => useCases.loadObligationCollectionById("oc-1"));
    expect(active).toEqual(activeCollection);

    // Active lookup against deleted record returns null
    const hiddenDeleted = await runWithTenant("demo", () =>
      useCases.loadObligationCollectionById("oc-2"),
    );
    expect(hiddenDeleted).toBeNull();

    // Deleted lookup against active record returns null
    const hiddenActive = await runWithTenant("demo", () =>
      useCases.loadObligationCollectionById("oc-1", true),
    );
    expect(hiddenActive).toBeNull();

    // Deleted lookup against deleted record returns deleted record
    const foundDeleted = await runWithTenant("demo", () =>
      useCases.loadObligationCollectionById("oc-2", true),
    );
    expect(foundDeleted).toEqual(deletedCollection);
  });

  it("loadObligationCollectionsByIds scopes soft-deleted records", async () => {
    const repo = createFakeRepo();
    const activeCollection = {
      id: "oc-1",
      receipt_no: "REC-001",
      received_date: "2026-09-01",
      sender_id: "c-1",
      reference_id: null,
      amount: 100,
      currency_id: "USD",
      payment_mode: "cash" as const,
      obligation_type_id: "type-1",
      mujtahid_representative_id: "rep-1",
      received_by: "u-1",
    };
    const deletedCollection = {
      ...activeCollection,
      id: "oc-2",
      deletedAt: "2026-09-02T00:00:00.000Z",
    };

    (repo.findObligationCollectionsByIds as any).mockImplementation(
      async (_tenant: string, ids: string[], opts?: { includeDeleted?: boolean }) => {
        const all = [activeCollection, deletedCollection].filter((c) => ids.includes(c.id));
        if (opts?.includeDeleted) return all.filter((c) => Boolean((c as any).deletedAt));
        return all.filter((c) => !(c as any).deletedAt);
      },
    );
    const useCases = createObligationsUseCases(repo);

    const activeList = await runWithTenant("demo", () =>
      useCases.loadObligationCollectionsByIds(["oc-1", "oc-2"]),
    );
    expect(activeList).toEqual([activeCollection]);

    const deletedList = await runWithTenant("demo", () =>
      useCases.loadObligationCollectionsByIds(["oc-1", "oc-2"], true),
    );
    expect(deletedList).toEqual([deletedCollection]);
  });

  it("saveObligationCollection delegates to repository with tenant", async () => {
    const repo = createFakeRepo();
    const collection = {
      id: "oc-1",
      receipt_no: "REC-001",
      received_date: "2026-09-01",
      sender_id: "c-1",
      reference_id: null,
      amount: 100,
      currency_id: "USD",
      payment_mode: "Cash" as const,
      obligation_type_id: "type-1",
      mujtahid_representative_id: "rep-1",
      received_by: "u-1",
    };
    const useCases = createObligationsUseCases(repo);

    await runWithTenant("demo", () => useCases.saveObligationCollection(collection));

    expect(repo.saveObligationCollection).toHaveBeenCalledWith("demo", collection);
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createObligationsUseCases(repo);

    const metrics = await useCases.loadObligationsCommandMetrics();
    const singleType = await useCases.loadObligationTypeById("type-1");
    const typeList = await useCases.loadObligationTypesByIds(["type-1"]);
    const singleMujtahid = await useCases.loadMujtahidById("m-1");
    const mujtahidList = await useCases.loadMujtahidsByIds(["m-1"]);
    const singleRep = await useCases.loadMujtahidRepById("rep-1");
    const repList = await useCases.loadMujtahidRepsByIds(["rep-1"]);
    const singleWakala = await useCases.loadWakalaTypeById("w-1");
    const wakalaList = await useCases.loadWakalaTypesByIds(["w-1"]);
    const singleDist = await useCases.loadObligationDistributionById("d-1");
    const distList = await useCases.loadObligationDistributionsByIds(["d-1"]);
    const singleCollection = await useCases.loadObligationCollectionById("oc-1");
    const collectionList = await useCases.loadObligationCollectionsByIds(["oc-1"]);

    expect(metrics.total).toBe(0);
    expect(singleType).toBeNull();
    expect(typeList).toEqual([]);
    expect(singleMujtahid).toBeNull();
    expect(mujtahidList).toEqual([]);
    expect(singleRep).toBeNull();
    expect(repList).toEqual([]);
    expect(singleWakala).toBeNull();
    expect(wakalaList).toEqual([]);
    expect(singleDist).toBeNull();
    expect(distList).toEqual([]);
    expect(singleCollection).toBeNull();
    expect(collectionList).toEqual([]);
    expect(repo.aggregateObligationsCommandMetrics).not.toHaveBeenCalled();
  });
});
