/**
 * Shared Postgres-constraint translation for the Hasanat persistence layer.
 *
 * Migrations 0225/0226 enforce stock and ledger invariants in the database; the repositories turn
 * those constraint names into domain errors so routes answer 409 instead of a generic 500.
 */

import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";

export function rethrowHasanatViolation(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const constraint = (error as { constraint?: string } | null)?.constraint;

  if (code === "23514" && constraint === "hasanat_batches_remaining_chk") {
    throw new ConflictError(
      "Not enough Hasanat stock remaining in the selected batch.",
      "insufficient_stock",
    );
  }
  if (code === "23505" && constraint === "hasanat_redemp_ws_dist_uidx") {
    throw new ConflictError("This Hasanat card has already been redeemed.", "already_redeemed");
  }
  if (code === "23514" && constraint === "hasanat_redemp_points_used_chk") {
    throw new ConflictError("Points used must be greater than 0.");
  }
  if (code === "23503" && constraint === "hasanat_distributions_session_fk") {
    throw new ConflictError("The selected academic session no longer exists.");
  }

  throw error;
}

/** Run a tenant transaction, translating Hasanat constraint violations into domain errors. */
export async function runGuardedTenant<T>(
  tenant: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  try {
    return await withTenant(tenant, fn);
  } catch (error: unknown) {
    rethrowHasanatViolation(error);
  }
}
