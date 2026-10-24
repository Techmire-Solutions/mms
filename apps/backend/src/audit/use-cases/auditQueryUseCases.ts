import type { AuditQueryRepository } from "../repository/auditQueryRepository.js";
import * as auditQueryAdapter from "../repository/auditQueryAdapter.js";

/**
 * Composition root for tenant audit-trail reads. `repo` is injectable so tests can
 * supply a fake repository; production uses the Drizzle adapter.
 */
export function createAuditQueryUseCases(
  repo: AuditQueryRepository = auditQueryAdapter,
): AuditQueryRepository {
  return {
    listAuditEvents: repo.listAuditEvents,
    listAuditEventsForExport: repo.listAuditEventsForExport,
    getLatestVerificationRun: repo.getLatestVerificationRun,
    listMerkleRoots: repo.listMerkleRoots,
  };
}

export const auditQueryUseCases = createAuditQueryUseCases();

// Named exports let route handlers import the use-case surface directly.
export const {
  listAuditEvents,
  listAuditEventsForExport,
  getLatestVerificationRun,
  listMerkleRoots,
} = auditQueryUseCases;
