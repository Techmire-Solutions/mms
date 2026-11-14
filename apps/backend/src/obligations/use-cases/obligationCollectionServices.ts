/**
 * @file obligationCollectionServices.ts
 * @description The tenant-bulk replace service for obligation receipts.
 *
 * Split out of `obligationsUseCases` for the 300-line ceiling: the binding is a
 * {@link defineTenantBulkCollectionService} (list + replace + schema + broadcast key) that the
 * use cases only reference.
 */
import { obligationCollectionListSchema, type ObligationCollection } from "@mms/shared";
import { defineTenantBulkCollectionService } from "../../services/tenantBulkService.js";
import type { ObligationsRepository } from "../repository/obligationsRepository.js";

export function createObligationCollectionBulkService(repo: ObligationsRepository) {
  return defineTenantBulkCollectionService<ObligationCollection>(
    {
      listByWorkspace: repo.listObligationCollectionsByWorkspace,
      replaceForWorkspace: repo.replaceObligationCollectionsForWorkspace,
    },
    obligationCollectionListSchema,
    "obligation_collections",
  );
}
