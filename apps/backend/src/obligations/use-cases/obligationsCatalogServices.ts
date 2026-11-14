/**
 * @file obligationsCatalogServices.ts
 * @description The five tenant-bulk collection services behind the obligation catalogue.
 *
 * Split out of `obligationsCatalogUseCases` for the 300-line ceiling: each service is a
 * {@link defineTenantBulkCollectionService} binding (list + replace + schema + broadcast key),
 * and the use cases only orchestrate them.
 */
import type {
  Mujtahid,
  MujtahidRep,
  ObligationDistribution,
  ObligationType,
  WakalaType,
} from "@mms/shared";
import {
  mujtahidListSchema,
  mujtahidRepListSchema,
  obligationDistributionListSchema,
  obligationTypeListSchema,
  wakalaTypeListSchema,
} from "@mms/shared";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import type { ObligationsRepository } from "../repository/obligationsRepository.js";

export function createObligationsCatalogServices(repo: ObligationsRepository) {
  return {
    obligationTypeService: defineTenantBulkCollectionService<ObligationType>(
      {
        listByWorkspace: repo.listObligationTypesByWorkspace,
        replaceForWorkspace: repo.replaceObligationTypesForWorkspace,
      },
      obligationTypeListSchema,
      "obligation_types",
    ),
    mujtahidService: defineTenantBulkCollectionService<Mujtahid>(
      {
        listByWorkspace: repo.listMujtahidsByWorkspace,
        replaceForWorkspace: repo.replaceMujtahidsForWorkspace,
      },
      mujtahidListSchema,
      "mujtahids",
    ),
    mujtahidRepService: defineTenantBulkCollectionService<MujtahidRep>(
      {
        listByWorkspace: repo.listMujtahidRepsByWorkspace,
        replaceForWorkspace: repo.replaceMujtahidRepsForWorkspace,
      },
      mujtahidRepListSchema,
      "mujtahid_reps",
    ),
    wakalaTypeService: defineTenantBulkCollectionService<WakalaType>(
      {
        listByWorkspace: repo.listWakalaTypesByWorkspace,
        replaceForWorkspace: repo.replaceWakalaTypesForWorkspace,
      },
      wakalaTypeListSchema,
      "wakala_types",
    ),
    distributionService: defineTenantBulkCollectionService<ObligationDistribution>(
      {
        listByWorkspace: repo.listObligationDistributionsByWorkspace,
        replaceForWorkspace: repo.replaceObligationDistributionsForWorkspace,
      },
      obligationDistributionListSchema,
      "obligation_distributions",
    ),
  };
}
