import type { TenantTransaction } from "../tenant-context.js";
import { withTenant } from "../tenant-context.js";

/** Organization positions removed — supervisor position resolution is unavailable. */
export async function resolveSupervisorPrimaryPositionId(
  _tx: TenantTransaction,
  _subdomain: string,
  _supervisorId: string,
): Promise<string | null> {
  return null;
}

/** Organization positions removed — subordinate counts are always zero. */
export async function countSubordinates(_tenant: string, _supervisorId: string): Promise<number> {
  return 0;
}

export async function countSubordinatesBatch(
  _tenant: string,
  supervisorIds: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const id of supervisorIds) result[id] = 0;
  return result;
}

/** Organization positions removed — reassignment is a no-op. */
export async function reassignSubordinates(
  tenant: string,
  _oldSupervisorId: string,
  _newSupervisorId: string | null,
  txClient?: TenantTransaction,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const execute = async (_tx: TenantTransaction) => 0;
  if (txClient) return execute(txClient);
  return withTenant(subdomain, execute);
}
