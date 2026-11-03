import { getRequestTenant } from "../../lib/tenantContext.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

/**
 * Evicts the students domain cache once the caller's transaction has settled.
 *
 * `repo.save` already evicts, but that runs while the surrounding transaction is still open (nested
 * `withTenant` joins it), so a concurrent reader can refill L1/L2 with the pre-commit row and a
 * rollback would never be followed by another eviction. Use with `.finally()` around the
 * `runInTransaction` call so both commit and rollback are covered.
 */
export async function invalidateStudentsCache(): Promise<void> {
  const tenant = getRequestTenant();
  if (tenant) await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
}
