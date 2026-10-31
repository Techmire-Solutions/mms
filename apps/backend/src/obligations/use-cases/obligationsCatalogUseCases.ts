import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { assertDistributionAccountsValid } from "./obligationDistributionAccounts.js";
import {
  defineTenantBulkCollectionService,
  upsertWithBroadcast,
} from "../../services/tenantBulkService.js";
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

export function createObligationsCatalogUseCases(repo: ObligationsRepository) {
  const obligationTypeService = defineTenantBulkCollectionService<ObligationType>(
    {
      listByWorkspace: repo.listObligationTypesByWorkspace,
      replaceForWorkspace: repo.replaceObligationTypesForWorkspace,
    },
    obligationTypeListSchema,
    "obligation_types",
  );

  const mujtahidService = defineTenantBulkCollectionService<Mujtahid>(
    {
      listByWorkspace: repo.listMujtahidsByWorkspace,
      replaceForWorkspace: repo.replaceMujtahidsForWorkspace,
    },
    mujtahidListSchema,
    "mujtahids",
  );

  const mujtahidRepService = defineTenantBulkCollectionService<MujtahidRep>(
    {
      listByWorkspace: repo.listMujtahidRepsByWorkspace,
      replaceForWorkspace: repo.replaceMujtahidRepsForWorkspace,
    },
    mujtahidRepListSchema,
    "mujtahid_reps",
  );

  const wakalaTypeService = defineTenantBulkCollectionService<WakalaType>(
    {
      listByWorkspace: repo.listWakalaTypesByWorkspace,
      replaceForWorkspace: repo.replaceWakalaTypesForWorkspace,
    },
    wakalaTypeListSchema,
    "wakala_types",
  );

  const distributionService = defineTenantBulkCollectionService<ObligationDistribution>(
    {
      listByWorkspace: repo.listObligationDistributionsByWorkspace,
      replaceForWorkspace: repo.replaceObligationDistributionsForWorkspace,
    },
    obligationDistributionListSchema,
    "obligation_distributions",
  );

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
    replaceObligationTypes: obligationTypeService.replace,

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
    replaceMujtahids: mujtahidService.replace,

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
    replaceMujtahidReps: mujtahidRepService.replace,

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
    replaceWakalaTypes: wakalaTypeService.replace,

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
    upsertObligationDistributions: (records: ObligationDistribution[]) =>
      upsertWithBroadcast(
        obligationDistributionListSchema,
        records,
        repo.bulkSaveObligationDistributions,
        "obligation_distributions",
      ),
  };
}
