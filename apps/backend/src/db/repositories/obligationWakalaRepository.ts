import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type WakalaType } from "@mms/shared";
import { wakalaTypes } from "../schema.js";
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
