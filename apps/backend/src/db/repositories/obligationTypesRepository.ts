import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ObligationType } from "@mms/shared";
import { obligationTypes } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type ObligationTypeRow = typeof obligationTypes.$inferSelect;

export function obligationTypeRowToRecord(row: ObligationTypeRow): ObligationType {
  return {
    id: row.id,
    name: row.name,
    quantity_based: row.quantityBased,
    designated_for: row.designatedFor as ObligationType["designated_for"],
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listObligationTypesByWorkspace(tenant: string): Promise<ObligationType[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationTypes.id,
        workspaceSubdomain: obligationTypes.workspaceSubdomain,
        name: obligationTypes.name,
        quantityBased: obligationTypes.quantityBased,
        designatedFor: obligationTypes.designatedFor,
        createdAt: obligationTypes.createdAt,
        updatedAt: obligationTypes.updatedAt,
      })
      .from(obligationTypes)
      .where(eq(obligationTypes.workspaceSubdomain, subdomain));
    return rows.map(obligationTypeRowToRecord);
  });
}

export async function findObligationTypeById(
  tenant: string,
  id: string,
): Promise<ObligationType | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationTypes.id,
        workspaceSubdomain: obligationTypes.workspaceSubdomain,
        name: obligationTypes.name,
        quantityBased: obligationTypes.quantityBased,
        designatedFor: obligationTypes.designatedFor,
        createdAt: obligationTypes.createdAt,
        updatedAt: obligationTypes.updatedAt,
      })
      .from(obligationTypes)
      .where(
        and(eq(obligationTypes.workspaceSubdomain, subdomain), eq(obligationTypes.id, trimmedId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? obligationTypeRowToRecord(row) : null;
  });
}

export async function findObligationTypesByIds(
  tenant: string,
  ids: string[],
): Promise<ObligationType[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: obligationTypes.id,
        workspaceSubdomain: obligationTypes.workspaceSubdomain,
        name: obligationTypes.name,
        quantityBased: obligationTypes.quantityBased,
        designatedFor: obligationTypes.designatedFor,
        createdAt: obligationTypes.createdAt,
        updatedAt: obligationTypes.updatedAt,
      })
      .from(obligationTypes)
      .where(
        and(
          eq(obligationTypes.workspaceSubdomain, subdomain),
          inArray(obligationTypes.id, cleanIds),
        ),
      );
    return rows.map(obligationTypeRowToRecord);
  });
}

export async function saveObligationType(tenant: string, record: ObligationType): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationTypes)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        quantityBased: Boolean(record.quantity_based),
        designatedFor: record.designated_for ?? "Both",
        createdAt: record.created_at ? new Date(record.created_at) : new Date(),
        updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
      })
      .onConflictDoUpdate({
        target: [obligationTypes.workspaceSubdomain, obligationTypes.id],
        set: {
          name: record.name,
          quantityBased: Boolean(record.quantity_based),
          designatedFor: record.designated_for ?? "Both",
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveObligationTypes(
  tenant: string,
  records: ObligationType[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationType>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(obligationTypes)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          name: record.name,
          quantityBased: Boolean(record.quantity_based),
          designatedFor: record.designated_for ?? "Both",
          createdAt: record.created_at ? new Date(record.created_at) : new Date(),
          updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [obligationTypes.workspaceSubdomain, obligationTypes.id],
        set: {
          name: sql`excluded.name`,
          quantityBased: sql`excluded.quantity_based`,
          designatedFor: sql`excluded.designated_for`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceObligationTypesForWorkspace(
  tenant: string,
  records: ObligationType[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ObligationType>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  const keepIds = uniqueRecords.map((r) => r.id);

  await withTenant(subdomain, async (tx) => {
    if (keepIds.length === 0) {
      await tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, subdomain));
    } else {
      await tx
        .delete(obligationTypes)
        .where(
          and(
            eq(obligationTypes.workspaceSubdomain, subdomain),
            notInArray(obligationTypes.id, keepIds),
          ),
        );

      await tx
        .insert(obligationTypes)
        .values(
          uniqueRecords.map((record) => ({
            id: record.id,
            workspaceSubdomain: subdomain,
            name: record.name,
            quantityBased: Boolean(record.quantity_based),
            designatedFor: record.designated_for ?? "Both",
            createdAt: record.created_at ? new Date(record.created_at) : new Date(),
            updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [obligationTypes.workspaceSubdomain, obligationTypes.id],
          set: {
            name: sql`excluded.name`,
            quantityBased: sql`excluded.quantity_based`,
            designatedFor: sql`excluded.designated_for`,
            updatedAt: new Date(),
          },
        });
    }
  });
}
