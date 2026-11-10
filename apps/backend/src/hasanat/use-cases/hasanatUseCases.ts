/**
 * Hasanat use-case facade — composition root over the repository port.
 *
 * Reads are delegated to {@link createHasanatQueryUseCases}. Writes with business meaning
 * (issuance, redemption, status, edit) are delegated to the domain use cases in this folder, which
 * own the rules; the soft-delete paths reuse the generic relational service.
 */

import type { HasanatRepository } from "../repository/hasanatRepository.js";
import { hasanatRepository } from "../repository/hasanatRepositoryAdapter.js";
import { getRequestTenant, getRequestUserId } from "../../lib/tenantContext.js";
import {
  defineTenantBulkCollectionService,
  upsertWithBroadcast,
} from "../../services/tenantBulkService.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { createHasanatCardWriteFacade } from "./hasanatCardWriteFacade.js";
import {
  batchListSchema,
  denomListSchema,
  normalizeHasanatModulePreferences,
  type Denomination,
  type HasanatModulePreferences,
  type Distribution,
  type DistributionCreate,
  type DistributionStatusChange,
  type DistributionUpdate,
  type RedeemCardBody,
  type Redemption,
  type ReverseRedemptionBody,
  type StockBatch,
} from "@mms/shared";
import { createHasanatQueryUseCases } from "./hasanatQueryUseCases.js";
import { issueHasanatCard } from "./hasanatIssuanceUseCases.js";
import { replaceBatchesWithAudit, replaceDenomsWithAudit } from "./hasanatCatalogUseCases.js";
import { redeemHasanatCard, voidHasanatRedemption } from "./hasanatRedemptionUseCases.js";
import { changeHasanatCardStatus, updateHasanatCard } from "./hasanatCardUseCases.js";
import {
  getHasanatStudentReport,
  getHasanatStudentSummary,
  reconcileTenantTiers,
} from "./hasanatTierUseCases.js";

/** Normalized module preferences (quota cap + award scope). */
async function loadPreferences(
  tenant: string,
  repo: HasanatRepository,
): Promise<HasanatModulePreferences> {
  const raw = repo.getModulePreferences ? await repo.getModulePreferences(tenant) : null;
  return normalizeHasanatModulePreferences(raw);
}

export function createHasanatUseCases(repo: HasanatRepository = hasanatRepository) {
  const queries = createHasanatQueryUseCases(repo);

  const denomService = defineTenantBulkCollectionService<Denomination>(
    {
      listByWorkspace: repo.listDenomsByWorkspace,
      replaceForWorkspace: repo.replaceDenomsForWorkspace,
    },
    denomListSchema,
    "hasanat_denoms",
  );

  const batchService = defineTenantBulkCollectionService<StockBatch>(
    {
      listByWorkspace: repo.listBatchesByWorkspace,
      replaceForWorkspace: repo.replaceBatchesForWorkspace,
    },
    batchListSchema,
    "hasanat_batches",
  );

  const distributionCrud = createGenericRelationalService<Distribution>({
    repo: {
      listByWorkspace: repo.listDistributionsByWorkspace,
      findById: repo.findDistributionById,
      save: repo.saveDistribution,
      bulkDelete: repo.bulkSoftDeleteDistributions,
      bulkRestore: repo.bulkRestoreDistributions,
    },
    schema: undefined,
    websocketCollection: "hasanat_distributions",
    idPrefix: "hd",
  });

  function requireTenant(): string {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context is required for a Hasanat write");
    return tenant;
  }

  const cardWrites = createHasanatCardWriteFacade({
    repo,
    crud: distributionCrud,
    requireTenant,
    requireActorUserId,
    loadPreferences: () => loadPreferences(requireTenant(), repo),
  });

  function requireActorUserId(): string {
    const userId = getRequestUserId();
    if (!userId) throw new Error("An authenticated user is required for a Hasanat write");
    return userId;
  }

  return {
    ...queries,

    // Denoms / batches (bulk-configured setup data)
    saveDenom: async (record: Denomination): Promise<void> => {
      const tenant = requireTenant();
      await repo.saveDenom(tenant, record);
      await broadcastCollection("hasanat_denoms");
    },
    /**
     * Replace the denomination catalogue: reconcile, then audit every changed row.
     * Point values are configuration — a silent change would re-price every future award.
     */
    replaceDenoms: (records: Denomination[]) => replaceDenomsWithAudit(repo, denomService, records),
    saveBatch: async (record: StockBatch): Promise<void> => {
      const tenant = requireTenant();
      await repo.saveBatch(tenant, record);
      await broadcastCollection("hasanat_batches");
    },
    replaceBatches: (records: StockBatch[]) => replaceBatchesWithAudit(repo, batchService, records),
    upsertDenoms: (records: Denomination[]) =>
      upsertWithBroadcast(denomListSchema, records, repo.bulkSaveDenoms, "hasanat_denoms"),
    upsertBatches: (records: StockBatch[]) =>
      upsertWithBroadcast(batchListSchema, records, repo.bulkSaveBatches, "hasanat_batches"),

    // Card lifecycle
    createDistribution: async (
      body: DistributionCreate,
      options?: { bypassAwardScope?: boolean },
    ): Promise<Distribution> => {
      const tenant = requireTenant();
      const actorUserId = requireActorUserId();
      const preferences = await loadPreferences(tenant, repo);
      const card = await issueHasanatCard(
        tenant,
        {
          body,
          actorUserId,
          quotaLimit: preferences.dailyAwardLimitPerInstructor,
          awardScope: preferences.awardScope,
          bypassAwardScope: options?.bypassAwardScope,
        },
        repo,
      );
      await broadcastCollection("hasanat_distributions");
      return card;
    },
    updateDistributionById: async (id: string, body: DistributionUpdate): Promise<Distribution> => {
      const tenant = requireTenant();
      const card = await updateHasanatCard(tenant, id, body, repo, {
        userId: getRequestUserId(),
      });
      await broadcastCollection("hasanat_distributions");
      return card;
    },
    changeDistributionStatus: async (
      id: string,
      body: DistributionStatusChange,
    ): Promise<Distribution> => {
      const tenant = requireTenant();
      const card = await changeHasanatCardStatus(tenant, id, body, repo, {
        userId: getRequestUserId(),
      });
      await broadcastCollection("hasanat_distributions");
      return card;
    },

    // Card delete/restore (tier-reconciled) and batch awarding.
    ...cardWrites,

    // Progression
    getStudentReport: async (filters: {
      sessionId?: string | null;
      classId?: string | null;
      from?: string | null;
      to?: string | null;
    }) => getHasanatStudentReport(requireTenant(), filters),
    getStudentSummary: async (studentId: string, sessionId?: string | null) =>
      getHasanatStudentSummary(requireTenant(), studentId, sessionId ?? null),
    reconcileTiers: async () =>
      reconcileTenantTiers(requireTenant(), { actorUserId: getRequestUserId() }),

    // Ledger
    redeemCard: async (
      distributionId: string,
      body: RedeemCardBody,
    ): Promise<{ redemption: Redemption }> => {
      const tenant = requireTenant();
      const result = await redeemHasanatCard(
        tenant,
        distributionId,
        body,
        { userId: getRequestUserId(), displayName: body.approvedBy ?? null },
        repo,
      );
      await broadcastCollection("hasanat_redemptions");
      await broadcastCollection("hasanat_distributions");
      return result;
    },
    voidRedemption: async (
      redemptionId: string,
      body: ReverseRedemptionBody,
    ): Promise<{ redemption: Redemption }> => {
      const tenant = requireTenant();
      const result = await voidHasanatRedemption(
        tenant,
        redemptionId,
        { reason: body.reason },
        { userId: getRequestUserId(), displayName: null },
        repo,
      );
      await broadcastCollection("hasanat_redemptions");
      await broadcastCollection("hasanat_distributions");
      return result;
    },
  };
}

export const hasanatUseCases = createHasanatUseCases();
