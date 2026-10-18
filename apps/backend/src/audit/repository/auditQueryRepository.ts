/**
 * @file auditQueryRepository.ts
 * @description Storage contract for tenant audit-trail reads.
 *
 * Use-cases depend on this interface — never on the concrete Drizzle queries in
 * `auditQueryAdapter.ts`. The adapter is the only implementation.
 */
type AuditQueryModule = typeof import("./auditQueryAdapter.js");

export interface AuditQueryRepository {
  listAuditEvents: AuditQueryModule["listAuditEvents"];
  listAuditEventsForExport: AuditQueryModule["listAuditEventsForExport"];
  getLatestVerificationRun: AuditQueryModule["getLatestVerificationRun"];
  listMerkleRoots: AuditQueryModule["listMerkleRoots"];
}
