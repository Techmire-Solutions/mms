import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ObligationDistribution, type WakalaType } from "@mms/shared";
import { obligationDistributions, wakalaTypes } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type WakalaTypeRow = typeof wakalaTypes.$inferSelect;

export function wakalaTypeRowToRecord(row: WakalaTypeRow): WakalaType {
  return {
    id: row.id,
    mujtahid_representative_id: row.mujtahidRepresentativeId,
    obligation_type_id: row.obligationTypeId,
  };
}

export async function listWakalaTypesByWorkspace(tenant: string): Promise<WakalaType[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: wakalaTypes.id,
        workspaceSubdomain: wakalaTypes.workspaceSubdomain,
        mujtahidRepresentativeId: wakalaTypes.mujtahidRepresentativeId,
        obligationTypeId: wakalaTypes.obligationTypeId,
        createdAt: wakalaTypes.createdAt,
        updatedAt: wakalaTypes.updatedAt,
      })
      .from(wakalaTypes)
      .where(eq(wakalaTypes.workspaceSubdomain, subdomain));
    return rows.map(wakalaTypeRowToRecord);
  });
}

export async function findWakalaTypeById(tenant: string, id: string): Promise<WakalaType | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: wakalaTypes.id,
        workspaceSubdomain: wakalaTypes.workspaceSubdomain,
        mujtahidRepresentativeId: wakalaTypes.mujtahidRepresentativeId,
        obligationTypeId: wakalaTypes.obligationTypeId,
        createdAt: wakalaTypes.createdAt,
        updatedAt: wakalaTypes.updatedAt,
      })
      .from(wakalaTypes)
      .where(and(eq(wakalaTypes.workspaceSubdomain, subdomain), eq(wakalaTypes.id, trimmedId)))
      .limit(1);
    const row = rows[0];
    return row ? wakalaTypeRowToRecord(row) : null;
  });
}

export async function findWakalaTypesByIds(tenant: string, ids: string[]): Promise<WakalaType[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: wakalaTypes.id,
        workspaceSubdomain: wakalaTypes.workspaceSubdomain,
        mujtahidRepresentativeId: wakalaTypes.mujtahidRepresentativeId,
        obligationTypeId: wakalaTypes.obligationTypeId,
        createdAt: wakalaTypes.createdAt,
        updatedAt: wakalaTypes.updatedAt,
      })
      .from(wakalaTypes)
      .where(and(eq(wakalaTypes.workspaceSubdomain, subdomain), inArray(wakalaTypes.id, cleanIds)));
    return rows.map(wakalaTypeRowToRecord);
  });
}

export async function saveWakalaType(tenant: string, record: WakalaType): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(wakalaTypes)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        mujtahidRepresentativeId: record.mujtahid_representative_id,
        obligationTypeId: record.obligation_type_id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
        set: {
          mujtahidRepresentativeId: record.mujtahid_representative_id,
          obligationTypeId: record.obligation_type_id,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveWakalaTypes(tenant: string, records: WakalaType[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, WakalaType>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(wakalaTypes)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          mujtahidRepresentativeId: record.mujtahid_representative_id,
          obligationTypeId: record.obligation_type_id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
        set: {
          mujtahidRepresentativeId: sql`excluded.mujtahid_representative_id`,
          obligationTypeId: sql`excluded.obligation_type_id`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceWakalaTypesForWorkspace(
  tenant: string,
  records: WakalaType[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, WakalaType>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  const keepIds = uniqueRecords.map((r) => r.id);

  await withTenant(subdomain, async (tx) => {
    if (keepIds.length === 0) {
      await tx.delete(wakalaTypes).where(eq(wakalaTypes.workspaceSubdomain, subdomain));
    } else {
      await tx
        .delete(wakalaTypes)
        .where(
          and(eq(wakalaTypes.workspaceSubdomain, subdomain), notInArray(wakalaTypes.id, keepIds)),
        );

      await tx
        .insert(wakalaTypes)
        .values(
          uniqueRecords.map((record) => ({
            id: record.id,
            workspaceSubdomain: subdomain,
            mujtahidRepresentativeId: record.mujtahid_representative_id,
            obligationTypeId: record.obligation_type_id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
          set: {
            mujtahidRepresentativeId: sql`excluded.mujtahid_representative_id`,
            obligationTypeId: sql`excluded.obligation_type_id`,
            updatedAt: new Date(),
          },
        });
    }
  });
}

/**
 * Replaces a wakala and its distribution rules in **one** transaction.
 *
 * A wakala is meaningless without its split rules: the pair is one aggregate, but the UI used to
 * save them through two endpoints, so between the two commits the database held a wakala with no
 * rules — and a receipt saved in that window posted 100 % to the default income account. Deleting
 * the wakalas first is safe because their rules cascade; the incoming rules are then re-inserted
 * against the surviving wakalas.
 */
export async function replaceWakalaAggregateForWorkspace(
  tenant: string,
  wakalaRecords: WakalaType[],
  distributionRecords: ObligationDistribution[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const uniqueWakalas = new Map<string, WakalaType>();
  for (const record of wakalaRecords) {
    const cleanId = typeof record.id === "string" ? record.id.trim() : String(record.id);
    if (cleanId) uniqueWakalas.set(cleanId, { ...record, id: cleanId });
  }
  const wakalas = [...uniqueWakalas.values()];

  const uniqueDistributions = new Map<string, ObligationDistribution>();
  for (const record of distributionRecords) {
    const cleanId = typeof record.id === "string" ? record.id.trim() : String(record.id);
    if (cleanId) uniqueDistributions.set(cleanId, { ...record, id: cleanId });
  }
  const distributions = [...uniqueDistributions.values()];

  const keepWakalaIds = wakalas.map((record) => record.id);
  const keepDistributionIds = distributions.map((record) => record.id);

  await withTenant(subdomain, async (tx) => {
    if (keepWakalaIds.length === 0) {
      await tx.delete(wakalaTypes).where(eq(wakalaTypes.workspaceSubdomain, subdomain));
    } else {
      await tx
        .delete(wakalaTypes)
        .where(
          and(
            eq(wakalaTypes.workspaceSubdomain, subdomain),
            notInArray(wakalaTypes.id, keepWakalaIds),
          ),
        );

      await tx
        .insert(wakalaTypes)
        .values(
          wakalas.map((record) => ({
            id: record.id,
            workspaceSubdomain: subdomain,
            mujtahidRepresentativeId: record.mujtahid_representative_id,
            obligationTypeId: record.obligation_type_id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
          set: {
            mujtahidRepresentativeId: sql`excluded.mujtahid_representative_id`,
            obligationTypeId: sql`excluded.obligation_type_id`,
            updatedAt: new Date(),
          },
        });
    }

    if (keepDistributionIds.length === 0) {
      await tx
        .delete(obligationDistributions)
        .where(eq(obligationDistributions.workspaceSubdomain, subdomain));
      return;
    }

    await tx
      .delete(obligationDistributions)
      .where(
        and(
          eq(obligationDistributions.workspaceSubdomain, subdomain),
          notInArray(obligationDistributions.id, keepDistributionIds),
        ),
      );

    await tx
      .insert(obligationDistributions)
      .values(
        distributions.map((record) => ({
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
