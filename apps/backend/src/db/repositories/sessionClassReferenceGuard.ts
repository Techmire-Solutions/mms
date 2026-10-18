import { sql } from 'drizzle-orm';
import type { TenantTransaction } from '../tenant-context.js';

function idList(ids: readonly string[]) {
  return sql.join(ids.map((id) => sql`${id}`), sql`, `);
}

/** Runs a probe with archived rows visible (RLS hides them otherwise), then restores visibility. */
async function withArchivedVisible(tx: TenantTransaction, probe: () => Promise<boolean>): Promise<boolean> {
  await tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
  try {
    return await probe();
  } finally {
    await tx.execute(sql`SELECT set_config('app.include_deleted', 'false', true)`);
  }
}

/**
 * True when any row — active or archived — still points at one of the classes through a
 * restricting foreign key (migration 0171): attendance, fee structures, hasanat, question papers.
 */
export async function hasClassReferencesTx(tx: TenantTransaction, subdomain: string, classIds: readonly string[]): Promise<boolean> {
  if (classIds.length === 0) return false;
  const ids = idList(classIds);
  return withArchivedVisible(tx, async () => {
    const result = await tx.execute<{ found: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM attendance WHERE workspace_subdomain = ${subdomain} AND class_id IN (${ids}))
          OR EXISTS (SELECT 1 FROM finance_fee_structures WHERE workspace_subdomain = ${subdomain} AND class_id IN (${ids}))
          OR EXISTS (SELECT 1 FROM hasanat_distributions WHERE workspace_subdomain = ${subdomain} AND class_id IN (${ids}))
          OR EXISTS (SELECT 1 FROM tests WHERE workspace_subdomain = ${subdomain} AND class_id IN (${ids})) AS found
    `);
    return result.rows[0]?.found === true;
  });
}

/** True when attendance (active or archived) was marked against one of the sections. */
export async function hasSectionAttendanceTx(tx: TenantTransaction, subdomain: string, sectionIds: readonly string[]): Promise<boolean> {
  if (sectionIds.length === 0) return false;
  const ids = idList(sectionIds);
  return withArchivedVisible(tx, async () => {
    const result = await tx.execute<{ found: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM attendance WHERE workspace_subdomain = ${subdomain} AND section_id IN (${ids})) AS found
    `);
    return result.rows[0]?.found === true;
  });
}
