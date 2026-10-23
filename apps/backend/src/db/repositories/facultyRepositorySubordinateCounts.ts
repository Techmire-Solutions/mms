import { sql } from "drizzle-orm";
import type { TenantTransaction } from "../tenant-context.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

/** Organization positions removed — supervisor position resolution is unavailable. */
export async function resolveSupervisorPrimaryPositionId(
  _tx: TenantTransaction,
  _subdomain: string,
  _supervisorId: string,
): Promise<string | null> {
  return null;
}

/** Counts direct subordinates reporting to a given supervisor. */
export async function countSubordinates(tenant: string, supervisorId: string): Promise<number> {
  const batch = await countSubordinatesBatch(tenant, [supervisorId]);
  return batch[supervisorId] ?? 0;
}

/** Counts subordinates in batch for a list of supervisor faculty IDs. */
export async function countSubordinatesBatch(
  tenant: string,
  supervisorIds: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const id of supervisorIds) result[id] = 0;
  if (!supervisorIds.length) return result;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const res = await tx.execute<{ supervisor_id: string; count: string | number }>(sql`
      SELECT
        sup_fa.faculty_id AS supervisor_id,
        count(DISTINCT sub_fa.faculty_id)::int AS count
      FROM faculty_assignments sup_fa
      JOIN faculty_designations child_desig
        ON child_desig.workspace_subdomain = sup_fa.workspace_subdomain
        AND child_desig.parent_designation_id = sup_fa.designation_id
        AND child_desig.deleted_at IS NULL
      JOIN faculty_assignments sub_fa
        ON sub_fa.workspace_subdomain = sup_fa.workspace_subdomain
        AND sub_fa.designation_id = child_desig.id
        AND sub_fa.is_primary = true
        AND sub_fa.status = 'active'
        AND sub_fa.deleted_at IS NULL
      JOIN faculty sf
        ON sf.workspace_subdomain = sub_fa.workspace_subdomain
        AND sf.id = sub_fa.faculty_id
        AND sf.deleted_at IS NULL
      WHERE sup_fa.workspace_subdomain = ${subdomain}
        AND sup_fa.faculty_id = ANY(${supervisorIds}::text[])
        AND sup_fa.is_primary = true
        AND sup_fa.status = 'active'
        AND sup_fa.deleted_at IS NULL
        AND sub_fa.faculty_id <> sup_fa.faculty_id
      GROUP BY sup_fa.faculty_id
    `);
    for (const row of res.rows ?? []) {
      if (row.supervisor_id) {
        result[String(row.supervisor_id)] = Number(row.count) || 0;
      }
    }
    return result;
  });
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
