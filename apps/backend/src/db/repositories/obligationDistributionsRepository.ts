import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ObligationDistribution } from "@mms/shared";
import { obligationDistributions } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type ObligationDistributionRow = typeof obligationDistributions.$inferSelect;

export function obligationDistributionRowToRecord(
  row: ObligationDistributionRow,
): ObligationDistribution {
  return {
    id: row.id,
    name: row.name,
    percentage: Number(row.percentage),
    wakala_type_id: row.wakalaTypeId,
    type: row.type as ObligationDistribution["type"],
    account_id: row.accountId ?? null,
  };
}

export async function listObligationDistributionsByWorkspace(
  tenant: string,
): Promise<ObligationDistribution[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationDistributions.id,
        workspaceSubdomain: obligationDistributions.workspaceSubdomain,
        name: obligationDistributions.name,
        percentage: obligationDistributions.percentage,
        wakalaTypeId: obligationDistributions.wakalaTypeId,
        type: obligationDistributions.type,
        accountId: obligationDistributions.accountId,
        createdAt: obligationDistributions.createdAt,
        updatedAt: obligationDistributions.updatedAt,
      })
      .from(obligationDistributions)
      .where(eq(obligationDistributions.workspaceSubdomain, subdomain));
    return rows.map(obligationDistributionRowToRecord);
  });
}

export async function findObligationDistributionById(
  tenant: string,
  id: string,
): Promise<ObligationDistribution | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationDistributions.id,
        workspaceSubdomain: obligationDistributions.workspaceSubdomain,
        name: obligationDistributions.name,
        percentage: obligationDistributions.percentage,
        wakalaTypeId: obligationDistributions.wakalaTypeId,
        type: obligationDistributions.type,
        accountId: obligationDistributions.accountId,
        createdAt: obligationDistributions.createdAt,
        updatedAt: obligationDistributions.updatedAt,
      })
      .from(obligationDistributions)
      .where(
        and(
          eq(obligationDistributions.workspaceSubdomain, subdomain),
          eq(obligationDistributions.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? obligationDistributionRowToRecord(row) : null;
  });
}

export async function findObligationDistributionsByIds(
  tenant: string,
  ids: string[],
): Promise<ObligationDistribution[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationDistributions.id,
        workspaceSubdomain: obligationDistributions.workspaceSubdomain,
        name: obligationDistributions.name,
        percentage: obligationDistributions.percentage,
        wakalaTypeId: obligationDistributions.wakalaTypeId,
        type: obligationDistributions.type,
        accountId: obligationDistributions.accountId,
        createdAt: obligationDistributions.createdAt,
        updatedAt: obligationDistributions.updatedAt,
      })
      .from(obligationDistributions)
      .where(
        and(
          eq(obligationDistributions.workspaceSubdomain, subdomain),
          inArray(obligationDistributions.id, cleanIds),
        ),
      );
    return rows.map(obligationDistributionRowToRecord);
  });
}

export async function saveObligationDistribution(
  tenant: string,
  record: ObligationDistribution,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationDistributions)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        percentage: String(record.percentage),
        wakalaTypeId: record.wakala_type_id,
        type: record.type,
        accountId: record.account_id ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [obligationDistributions.workspaceSubdomain, obligationDistributions.id],
        set: {
          name: record.name,
          percentage: String(record.percentage),
          wakalaTypeId: record.wakala_type_id,
          type: record.type,
          accountId: record.account_id ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveObligationDistributions(
  tenant: string,
  records: ObligationDistribution[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationDistribution>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationDistributions)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          name: record.name,
          percentage: String(record.percentage),
          wakalaTypeId: record.wakala_type_id,
          type: record.type,
          accountId: record.account_id ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [obligationDistributions.workspaceSubdomain, obligationDistributions.id],
        set: {
          name: sql`excluded.name`,
          percentage: sql`excluded.percentage`,
          wakalaTypeId: sql`excluded.wakala_type_id`,
          type: sql`excluded.type`,
          accountId: sql`excluded.account_id`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceObligationDistributionsForWorkspace(
  tenant: string,
  records: ObligationDistribution[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationDistribution>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  const keepIds = uniqueRecords.map((r) => r.id);

  await withTenant(subdomain, async (tx) => {
    if (keepIds.length === 0) {
      await tx
        .delete(obligationDistributions)
        .where(eq(obligationDistributions.workspaceSubdomain, subdomain));
    } else {
      await tx
        .delete(obligationDistributions)
        .where(
          and(
            eq(obligationDistributions.workspaceSubdomain, subdomain),
            notInArray(obligationDistributions.id, keepIds),
          ),
        );

      await tx
        .insert(obligationDistributions)
        .values(
          uniqueRecords.map((record) => ({
            id: record.id,
            workspaceSubdomain: subdomain,
            name: record.name,
            percentage: String(record.percentage),
            wakalaTypeId: record.wakala_type_id,
            type: record.type,
            accountId: record.account_id ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [obligationDistributions.workspaceSubdomain, obligationDistributions.id],
          set: {
            name: sql`excluded.name`,
            percentage: sql`excluded.percentage`,
            wakalaTypeId: sql`excluded.wakala_type_id`,
            type: sql`excluded.type`,
            accountId: sql`excluded.account_id`,
            updatedAt: new Date(),
          },
        });
    }
  });
}
