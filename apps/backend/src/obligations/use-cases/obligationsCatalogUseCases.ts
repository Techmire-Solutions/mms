import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { assertDistributionAccountsValid } from "./obligationDistributionAccounts.js";
import {
  assertNoCascadingLoss,
  assertSplitRulesComplete,
} from "../domain/obligationWriteGuards.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { auditCatalogueReplaced, auditWakalaAggregate } from "./obligationAuditTrail.js";
import { upsertWithBroadcast } from "../../services/tenantBulkService.js";
import { createObligationsCatalogServices } from "./obligationsCatalogServices.js";
import {
  dedupeTrimmedIds,
  type ObligationType,
  type Mujtahid,
  type MujtahidRep,
  type WakalaType,
  type ObligationDistribution,
  obligationTypeListSchema,
  mujtahidListSchema,
  mujtahidRepListSchema,
  wakalaTypeListSchema,
  obligationDistributionListSchema,
} from "@mms/shared";

/**
 * Wraps a catalogue replace with the cascade guard.
 *
 * `replace*ForWorkspace` deletes every row the caller omitted and the catalogue FKs cascade
 * (`mujtahids → reps → wakala_types → obligation_distributions`), so a shortened
 * `PUT /mujtahids/bulk` used to wipe the wakalas *and* their split rules without a word — after
 * which every new receipt posted 100 % to income. The policy lives here (the repository only
 * reports counts); moving the FKs to RESTRICT is tracked as a follow-up.
 */
function guardedCatalogueReplace<T extends { id: string }>(
  repo: ObligationsRepository,
  options: {
    kind: "mujtahid" | "representative" | "wakala" | "obligationType";
    kindLabel: "mujtahid" | "representative" | "wakala type" | "obligation type";
    /** Audit table name for the replace row. */
    auditTable:
      | "obligation_types"
      | "mujtahids"
      | "mujtahid_reps"
      | "wakala_types"
      | "obligation_distributions";
    listExisting: (tenant: string) => Promise<T[]>;
    replace: (records: T[]) => Promise<T[]>;
  },
) {
  return async (records: T[]): Promise<T[]> => {
    const tenant = getRequestTenant();
    if (!tenant) return options.replace(records);
    const existing = await options.listExisting(tenant);
    const keep = new Set(records.map((record) => String(record.id).trim()));
    const doomed = existing.map((record) => record.id).filter((id) => !keep.has(id));
    if (doomed.length > 0) {
      const dependents = await repo.countCatalogueDependents(tenant, options.kind, doomed);
      assertNoCascadingLoss(options.kindLabel, doomed, dependents);
    }
    // The replace and its audit row share one transaction: a catalogue wipe (which cascades to
    // wakalas and split rules) must never commit without the actor and the removed ids recorded.
    return withTenant(tenant, async () => {
      const saved = await options.replace(records);
      await auditCatalogueReplaced(
        tenant,
        options.auditTable,
        existing.map((record) => record.id),
        saved.map((record) => String(record.id)),
      );
      return saved;
    });
  };
}

export function createObligationsCatalogUseCases(repo: ObligationsRepository) {
  const {
    obligationTypeService,
    mujtahidService,
    mujtahidRepService,
    wakalaTypeService,
    distributionService,
  } = createObligationsCatalogServices(repo);

  return {
    loadObligationTypes: obligationTypeService.load,
    loadObligationTypeById: async (id: string): Promise<ObligationType | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findObligationTypeById(tenant, cleanId);
    },
    loadObligationTypesByIds: async (ids: string[]): Promise<ObligationType[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findObligationTypesByIds(tenant, cleanIds);
    },
    saveObligationType: async (record: ObligationType): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await repo.saveObligationType(tenant, record);
    },
    // Guarded like the others: `obligation_collections_obligation_type_fk` is ON DELETE CASCADE,
    // so a shortened list would delete every receipt of an omitted type (audit G3).
    replaceObligationTypes: guardedCatalogueReplace<ObligationType>(repo, {
      kind: "obligationType",
      kindLabel: "obligation type",
      auditTable: "obligation_types",
      listExisting: (tenant) => repo.listObligationTypesByWorkspace(tenant),
      replace: (records) => obligationTypeService.replace(records),
    }),

    loadMujtahids: mujtahidService.load,
    loadMujtahidById: async (id: string): Promise<Mujtahid | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findMujtahidById(tenant, cleanId);
    },
    loadMujtahidsByIds: async (ids: string[]): Promise<Mujtahid[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findMujtahidsByIds(tenant, cleanIds);
    },
    saveMujtahid: async (record: Mujtahid): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await repo.saveMujtahid(tenant, record);
    },
    replaceMujtahids: guardedCatalogueReplace<Mujtahid>(repo, {
      kind: "mujtahid",
      auditTable: "mujtahids",
      kindLabel: "mujtahid",
      listExisting: repo.listMujtahidsByWorkspace,
      replace: mujtahidService.replace,
    }),

    loadMujtahidReps: mujtahidRepService.load,
    loadMujtahidRepById: async (id: string): Promise<MujtahidRep | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findMujtahidRepById(tenant, cleanId);
    },
    loadMujtahidRepsByIds: async (ids: string[]): Promise<MujtahidRep[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findMujtahidRepsByIds(tenant, cleanIds);
    },
    saveMujtahidRep: async (record: MujtahidRep): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await repo.saveMujtahidRep(tenant, record);
    },
    replaceMujtahidReps: guardedCatalogueReplace<MujtahidRep>(repo, {
      kind: "representative",
      auditTable: "mujtahid_reps",
      kindLabel: "representative",
      listExisting: repo.listMujtahidRepsByWorkspace,
      replace: mujtahidRepService.replace,
    }),

    loadWakalaTypes: wakalaTypeService.load,
    loadWakalaTypeById: async (id: string): Promise<WakalaType | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findWakalaTypeById(tenant, cleanId);
    },
    loadWakalaTypesByIds: async (ids: string[]): Promise<WakalaType[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findWakalaTypesByIds(tenant, cleanIds);
    },
    saveWakalaType: async (record: WakalaType): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await repo.saveWakalaType(tenant, record);
    },
    replaceWakalaTypes: guardedCatalogueReplace<WakalaType>(repo, {
      kind: "wakala",
      auditTable: "wakala_types",
      kindLabel: "wakala type",
      listExisting: repo.listWakalaTypesByWorkspace,
      replace: wakalaTypeService.replace,
    }),

    /**
     * Saves a wakala and its distribution rules as one aggregate, in one transaction.
     *
     * The two-endpoint sequence this replaces left a window where the wakala existed with no
     * rules, and a receipt saved in that window posted 100 % to the default income account.
     */
    replaceWakalaAggregate: async (input: {
      wakalaTypes: WakalaType[];
      distributions: ObligationDistribution[];
    }): Promise<{ wakalaTypes: WakalaType[]; distributions: ObligationDistribution[] }> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const parsedWakalas = wakalaTypeListSchema.parse(input.wakalaTypes);
      const parsedDistributions = obligationDistributionListSchema.parse(input.distributions);
      await assertDistributionAccountsValid(repo, tenant, parsedDistributions);
      assertSplitRulesComplete(parsedWakalas, parsedDistributions);
      const previousWakalas = await repo.listWakalaTypesByWorkspace(tenant);
      const previousDistributions = await repo.listObligationDistributionsByWorkspace(tenant);
      await withTenant(tenant, async () => {
        await repo.replaceWakalaAggregateForWorkspace(tenant, parsedWakalas, parsedDistributions);
        // Same transaction: a wakala/rule replace is destructive and must be attributable.
        await auditWakalaAggregate(
          tenant,
          previousWakalas.map((record) => record.id),
          previousDistributions.map((record) => record.id),
          parsedWakalas,
          parsedDistributions,
        );
      });
      await broadcastCollection("wakala_types");
      await broadcastCollection("obligation_distributions");
      return { wakalaTypes: parsedWakalas, distributions: parsedDistributions };
    },

    loadObligationDistributions: distributionService.load,
    loadObligationDistributionById: async (id: string): Promise<ObligationDistribution | null> => {
      const tenant = getRequestTenant();
      const cleanId = id?.trim();
      if (!tenant || !cleanId) return null;
      return repo.findObligationDistributionById(tenant, cleanId);
    },
    loadObligationDistributionsByIds: async (ids: string[]): Promise<ObligationDistribution[]> => {
      const tenant = getRequestTenant();
      if (!tenant) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      return repo.findObligationDistributionsByIds(tenant, cleanIds);
    },
    saveObligationDistribution: async (record: ObligationDistribution): Promise<void> => {
      const tenant = getRequestTenant();
      if (!tenant) return;
      await assertDistributionAccountsValid(repo, tenant, [record]);
      await repo.saveObligationDistribution(tenant, record);
    },
    replaceObligationDistributions: async (
      records: ObligationDistribution[],
    ): Promise<ObligationDistribution[]> => {
      const tenant = getRequestTenant();
      if (tenant) await assertDistributionAccountsValid(repo, tenant, records);
      return distributionService.replace(records);
    },

    upsertObligationTypes: (types: ObligationType[]) =>
      upsertWithBroadcast(
        obligationTypeListSchema,
        types,
        repo.bulkSaveObligationTypes,
        "obligation_types",
      ),
    upsertMujtahids: (records: Mujtahid[]) =>
      upsertWithBroadcast(mujtahidListSchema, records, repo.bulkSaveMujtahids, "mujtahids"),
    upsertMujtahidReps: (records: MujtahidRep[]) =>
      upsertWithBroadcast(
        mujtahidRepListSchema,
        records,
        repo.bulkSaveMujtahidReps,
        "mujtahid_reps",
      ),
    upsertWakalaTypes: (records: WakalaType[]) =>
      upsertWithBroadcast(wakalaTypeListSchema, records, repo.bulkSaveWakalaTypes, "wakala_types"),
    upsertObligationDistributions: async (
      records: ObligationDistribution[],
    ): Promise<ObligationDistribution[]> => {
      // The sibling save/replace paths validate the account mapping; the bulk upsert did not, so
      // a stale account id reached the posting engine and made the whole receipt unpostable.
      const tenant = getRequestTenant();
      if (tenant) await assertDistributionAccountsValid(repo, tenant, records);
      return upsertWithBroadcast(
        obligationDistributionListSchema,
        records,
        repo.bulkSaveObligationDistributions,
        "obligation_distributions",
      );
    },
  };
}
