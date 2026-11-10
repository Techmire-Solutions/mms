import { beforeEach, describe, expect, it, vi } from "vitest";
import { distributionCreateSchema, type Distribution, type Redemption } from "@mms/shared";
import { createHasanatUseCases } from "../hasanat/use-cases/hasanatUseCases.js";
import * as hasanatCardUseCases from "../hasanat/use-cases/hasanatCardUseCases.js";
import * as hasanatIssuanceUseCases from "../hasanat/use-cases/hasanatIssuanceUseCases.js";
import * as hasanatQueryUseCases from "../hasanat/use-cases/hasanatQueryUseCases.js";
import * as hasanatRedemptionUseCases from "../hasanat/use-cases/hasanatRedemptionUseCases.js";
import type { HasanatRepository } from "../hasanat/repository/hasanatRepository.js";
import { bindRequestUserId, runWithTenant } from "../lib/tenantContext.js";

const prefsState = vi.hoisted(() => ({ dailyAwardLimitPerInstructor: 0 }));

vi.mock("../lib/workspaceDay.js", () => ({
  workspaceTodayIso: vi.fn(async () => "2026-11-10"),
}));

vi.mock("../db/repositories/hasanatModulePreferencesRepository.js", () => ({
  getHasanatModulePreferences: vi.fn(async () => ({ ...prefsState })),
}));

vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn(async () => undefined) }));

const ACTIVE_CARD: Distribution = {
  id: "hd1",
  batchId: "batch1",
  denominationId: "den1",
  denominationName: "Gold",
  recipientType: "student",
  recipientStudentId: "stu1",
  recipientName: "Fatima",
  recipientClass: "Hifz A",
  classId: null,
  sessionId: null,
  quantity: 1,
  pointsSnapshot: 50,
  version: 3,
  clientRequestId: null,
  expiresOn: null,
  reason: "Excellent recitation",
  issuedDate: "2026-11-10",
  issuedByUserId: "u1",
  issuedBy: "Ustadha",
  status: "active",
};

const DENOM = {
  id: "den1",
  name: "Gold",
  points: 50,
  color: "amber",
  description: "",
  icon: "Star",
  active: true,
};

/** Bind the actor and tenant for one call — `enterWith` must sit in the calling context. */
function asActor<T>(tenant: string, fn: () => Promise<T>, userId = "u1"): Promise<T> {
  bindRequestUserId(userId);
  return runWithTenant(tenant, fn);
}

function createFakeRepo(): HasanatRepository {
  return {
    listDenomsByWorkspace: vi.fn().mockResolvedValue([DENOM]),
    findDenomById: vi.fn().mockResolvedValue(DENOM),
    findDenomsByIds: vi.fn().mockResolvedValue([DENOM]),
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
    findDistributionById: vi.fn().mockResolvedValue(ACTIVE_CARD),
    findDistributionsByIds: vi.fn().mockResolvedValue([]),
    saveDistribution: vi.fn().mockResolvedValue(undefined),
    bulkSaveDistributions: vi.fn().mockResolvedValue(undefined),
    replaceDistributionsForWorkspace: vi.fn().mockResolvedValue(undefined),
    bulkSoftDeleteDistributions: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreDistributions: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    listDistributionsPage: vi.fn().mockResolvedValue({
      distributions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),

    lockDistributionForUpdate: vi.fn().mockResolvedValue(ACTIVE_CARD),
    insertDistribution: vi
      .fn()
      .mockImplementation(
        async (
          _tenant: string,
          fields: Parameters<HasanatRepository["insertDistribution"]>[1],
        ) => ({
          ...ACTIVE_CARD,
          ...fields,
          status: "active",
          version: 0,
        }),
      ),
    updateDistributionVersioned: vi.fn().mockResolvedValue({ ...ACTIVE_CARD, version: 4 }),
    setDistributionStatus: vi
      .fn()
      .mockImplementation(async (_tenant: string, _id: string, status: Distribution["status"]) => ({
        ...ACTIVE_CARD,
        status,
      })),
    countIssuedByUserOnDate: vi.fn().mockResolvedValue(0),
    lockInstructorQuota: vi.fn().mockResolvedValue(undefined),
    findDistributionByClientRequestId: vi.fn().mockResolvedValue(null),
    findBatchRemaining: vi.fn().mockResolvedValue(10),

    listRedemptionsByWorkspace: vi.fn().mockResolvedValue([]),
    findRedemptionById: vi.fn().mockResolvedValue(null),
    findRedemptionsByIds: vi.fn().mockResolvedValue([]),
    appendRedemption: vi
      .fn()
      .mockImplementation(
        async (_tenant: string, fields: Parameters<HasanatRepository["appendRedemption"]>[1]) => ({
          id: fields.id,
          distributionId: fields.distributionId,
          studentName: fields.studentName,
          reward: fields.reward,
          pointsUsed: fields.pointsUsed,
          kind: fields.kind,
          date: fields.date,
        }),
      ),
    findRedemptionByClientRequestId: vi.fn().mockResolvedValue(null),
    findLiveRedemptionForCard: vi.fn().mockResolvedValue(null),
    findLedgerRow: vi.fn().mockResolvedValue(null),
    hasReversal: vi.fn().mockResolvedValue(false),
    listCardLedger: vi.fn().mockResolvedValue([]),
    replaceRedemptionsForWorkspace: vi.fn().mockResolvedValue(undefined),

    aggregateHasanatCommandMetrics: vi.fn().mockResolvedValue({
      totalStock: 10,
      available: 6,
      distributed: 4,
      redeemed: 1,
      active: 3,
      returned: 0,
      denominations: 1,
      totalPointsDistributed: 200,
      pointsThisWeek: 50,
      pointsLastWeek: 50,
    }),
    aggregateHasanatWidgetQueries: vi.fn().mockResolvedValue({}),
    loadHasanatReportAggregates: vi.fn().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    }),
    getModulePreferences: vi.fn(async () => ({ ...prefsState })),
  };
}

const ISSUE_BODY = distributionCreateSchema.parse({
  batchId: "batch1",
  denominationId: "den1",
  quantity: 1,
  recipientType: "student",
  recipientStudentId: "stu1",
  recipientName: "Fatima",
  issuedDate: "2026-11-10",
  reason: "Excellent recitation",
});

describe("hasanat use-cases (DI with fake repository)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefsState.dailyAwardLimitPerInstructor = 0;
  });

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

    const result = await runWithTenant("demo", () => useCases.upsertDenoms([DENOM]));

    expect(result).toEqual([DENOM]);
    expect(repo.bulkSaveDenoms).toHaveBeenCalledWith("demo", [DENOM]);
  });

  it("writes fail closed without a tenant instead of silently succeeding", async () => {
    bindRequestUserId(null);
    const repo = createFakeRepo();
    const useCases = createHasanatUseCases(repo);

    await expect(useCases.saveDenom(DENOM)).rejects.toThrow(/tenant/i);
    expect(repo.saveDenom).not.toHaveBeenCalled();
  });

  describe("issuance", () => {
    it("stamps the immutable value from the deed and the authenticated issuer", async () => {
      const repo = createFakeRepo();
      const useCases = createHasanatUseCases(repo);

      await asActor("demo", () => useCases.createDistribution(ISSUE_BODY));

      expect(repo.insertDistribution).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({
          pointsSnapshot: 50,
          issuedByUserId: "u1",
          quantity: 1,
        }),
      );
    });

    it("rejects an inactive denomination before writing", async () => {
      const repo = createFakeRepo();
      (repo.findDenomById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...DENOM,
        active: false,
      });
      const useCases = createHasanatUseCases(repo);

      await expect(asActor("demo", () => useCases.createDistribution(ISSUE_BODY))).rejects.toThrow(
        /inactive/i,
      );
      expect(repo.insertDistribution).not.toHaveBeenCalled();
    });

    it("enforces the instructor daily quota", async () => {
      const repo = createFakeRepo();
      prefsState.dailyAwardLimitPerInstructor = 5;
      (repo.countIssuedByUserOnDate as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      const useCases = createHasanatUseCases(repo);

      await expect(asActor("demo", () => useCases.createDistribution(ISSUE_BODY))).rejects.toThrow(
        /Daily awarding limit/i,
      );
    });

    it("replays an idempotent issuance instead of creating a duplicate", async () => {
      const repo = createFakeRepo();
      const replay = { ...ACTIVE_CARD, clientRequestId: "req-12345678" };
      (repo.findDistributionByClientRequestId as ReturnType<typeof vi.fn>).mockResolvedValue(
        replay,
      );
      const useCases = createHasanatUseCases(repo);

      const result = await asActor("demo", () =>
        useCases.createDistribution({ ...ISSUE_BODY, clientRequestId: "req-12345678" }),
      );

      expect(result).toEqual(replay);
      expect(repo.insertDistribution).not.toHaveBeenCalled();
    });
  });

  describe("redemption", () => {
    const redeemBody = {
      reward: "Storybook",
      pointsUsed: 50,
      date: "2026-11-10",
    };

    it("appends the ledger row and closes the card", async () => {
      const repo = createFakeRepo();
      const useCases = createHasanatUseCases(repo);

      const result = await asActor("demo", () => useCases.redeemCard("hd1", redeemBody));

      expect(result.redemption.pointsUsed).toBe(50);
      expect(repo.appendRedemption).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ kind: "redeem", reversalOfId: null, pointsUsed: 50 }),
      );
      expect(repo.setDistributionStatus).toHaveBeenCalledWith("demo", "hd1", "redeemed");
    });

    it("rejects a partial redemption instead of forfeiting the remainder", async () => {
      const repo = createFakeRepo();
      const useCases = createHasanatUseCases(repo);

      await expect(
        asActor("demo", () => useCases.redeemCard("hd1", { ...redeemBody, pointsUsed: 20 })),
      ).rejects.toThrow(/in full|partial/i);
      expect(repo.appendRedemption).not.toHaveBeenCalled();
    });

    it("rejects redemption of a card that is no longer active", async () => {
      const repo = createFakeRepo();
      (repo.lockDistributionForUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...ACTIVE_CARD,
        status: "returned",
      });
      const useCases = createHasanatUseCases(repo);

      await expect(asActor("demo", () => useCases.redeemCard("hd1", redeemBody))).rejects.toThrow(
        /returned/i,
      );
    });

    it("reverses by appending a reversal row and reopening the card", async () => {
      const repo = createFakeRepo();
      (repo.findLedgerRow as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "red1",
        distributionId: "hd1",
        studentName: "Fatima",
        reward: "Storybook",
        pointsUsed: 50,
        kind: "redeem",
        date: "2026-11-10",
      } satisfies Redemption);
      (repo.lockDistributionForUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...ACTIVE_CARD,
        status: "redeemed",
      });
      const useCases = createHasanatUseCases(repo);

      const result = await asActor("demo", () =>
        useCases.voidRedemption("red1", { reason: "Issued in error" }),
      );

      expect(result.redemption.kind).toBe("reversal");
      expect(repo.appendRedemption).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ kind: "reversal", reversalOfId: "red1", pointsUsed: 50 }),
      );
      expect(repo.setDistributionStatus).toHaveBeenCalledWith("demo", "hd1", "active");
    });
  });

  describe("status lifecycle", () => {
    it("allows active -> returned", async () => {
      const repo = createFakeRepo();
      const useCases = createHasanatUseCases(repo);

      await asActor("demo", () =>
        useCases.changeDistributionStatus("hd1", { status: "returned", expectedVersion: 3 }),
      );

      expect(repo.setDistributionStatus).toHaveBeenCalledWith("demo", "hd1", "returned");
    });

    it("rejects redeemed -> active", async () => {
      const repo = createFakeRepo();
      (repo.lockDistributionForUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...ACTIVE_CARD,
        status: "redeemed",
      });
      const useCases = createHasanatUseCases(repo);

      await expect(
        asActor("demo", () =>
          useCases.changeDistributionStatus("hd1", { status: "active", expectedVersion: 3 }),
        ),
      ).rejects.toThrow(/cannot become/i);
      expect(repo.setDistributionStatus).not.toHaveBeenCalled();
    });

    it("rejects a stale edit", async () => {
      const repo = createFakeRepo();
      const useCases = createHasanatUseCases(repo);

      await expect(
        asActor("demo", () =>
          useCases.updateDistributionById("hd1", {
            reason: "typo",
            expectedVersion: 99,
          }),
        ),
      ).rejects.toThrow(/changed since/i);
      expect(repo.updateDistributionVersioned).not.toHaveBeenCalled();
    });
  });

  describe("decomposed use-case exports", () => {
    it("exports all specialized use case handlers", () => {
      expect(typeof hasanatCardUseCases.changeHasanatCardStatus).toBe("function");
      expect(typeof hasanatCardUseCases.updateHasanatCard).toBe("function");
      expect(typeof hasanatIssuanceUseCases.issueHasanatCard).toBe("function");
      expect(typeof hasanatQueryUseCases.createHasanatQueryUseCases).toBe("function");
      expect(typeof hasanatRedemptionUseCases.redeemHasanatCard).toBe("function");
      expect(typeof hasanatRedemptionUseCases.voidHasanatRedemption).toBe("function");
    });
  });
});
