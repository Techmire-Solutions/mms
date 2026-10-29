/**
 * Audit implementation pointers — no standalone cryptographic recipe.
 *
 * Use packages/shared/src/auditTypes.ts for canonicalizeJson and
 * formatAuditEventHashInput; verify behavior with auditTypes.test.ts.
 * The writer is apps/backend/src/services/auditTrailService.ts.
 * Verification and checkpoint construction are in
 * apps/backend/src/services/auditVerificationService.ts.
 *
 * Advisory: preserve deployed framing, ordering, shard identity and algorithm
 * version. A new serializer or Merkle algorithm requires compatibility evidence
 * and a migration plan; do not paste an illustrative hash-concatenation recipe.
 * RFC 8785 conformance requires validating supported inputs and canonicalization
 * edge cases; sorted object keys alone do not establish conformance.
 */
