import { and, eq, inArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Denomination } from "@mms/shared";
import { hasanatDenoms } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type DenomRow = typeof hasanatDenoms.$inferSelect;
export function denomRowToRecord(row: DenomRow): Denomination {
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    color: row.color,
    description: row.description,
    icon: row.icon,
    active: row.active,
  };
}

export async function listDenomsByWorkspace(tenant: string): Promise<Denomination[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatDenoms.id,
        workspaceSubdomain: hasanatDenoms.workspaceSubdomain,
        name: hasanatDenoms.name,
        points: hasanatDenoms.points,
        color: hasanatDenoms.color,
        description: hasanatDenoms.description,
        icon: hasanatDenoms.icon,
        active: hasanatDenoms.active,
        updatedAt: hasanatDenoms.updatedAt,
        createdAt: hasanatDenoms.createdAt,
      })
      .from(hasanatDenoms)
      .where(eq(hasanatDenoms.workspaceSubdomain, subdomain));
    return rows.map(denomRowToRecord);
  });
}

export async function findDenomById(tenant: string, id: string): Promise<Denomination | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatDenoms.id,
        workspaceSubdomain: hasanatDenoms.workspaceSubdomain,
        name: hasanatDenoms.name,
        points: hasanatDenoms.points,
        color: hasanatDenoms.color,
        description: hasanatDenoms.description,
        icon: hasanatDenoms.icon,
        active: hasanatDenoms.active,
        updatedAt: hasanatDenoms.updatedAt,
        createdAt: hasanatDenoms.createdAt,
      })
      .from(hasanatDenoms)
      .where(and(eq(hasanatDenoms.workspaceSubdomain, subdomain), eq(hasanatDenoms.id, trimmedId)))
      .limit(1);
    const row = rows[0];
    return row ? denomRowToRecord(row) : null;
  });
}

export async function findDenomsByIds(tenant: string, ids: string[]): Promise<Denomination[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatDenoms.id,
        workspaceSubdomain: hasanatDenoms.workspaceSubdomain,
        name: hasanatDenoms.name,
        points: hasanatDenoms.points,
        color: hasanatDenoms.color,
        description: hasanatDenoms.description,
        icon: hasanatDenoms.icon,
        active: hasanatDenoms.active,
        updatedAt: hasanatDenoms.updatedAt,
        createdAt: hasanatDenoms.createdAt,
      })
      .from(hasanatDenoms)
      .where(
        and(eq(hasanatDenoms.workspaceSubdomain, subdomain), inArray(hasanatDenoms.id, cleanIds)),
      );
    return rows.map(denomRowToRecord);
  });
}

export async function saveDenom(tenant: string, record: Denomination): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatDenoms)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        points: record.points,
        color: record.color ?? "emerald",
        description: record.description ?? "",
        icon: record.icon ?? "Star",
        active: record.active ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
        set: {
          name: record.name,
          points: record.points,
          color: record.color ?? "emerald",
          description: record.description ?? "",
          icon: record.icon ?? "Star",
          active: record.active ?? true,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveDenoms(tenant: string, records: Denomination[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Denomination>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatDenoms)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          points: r.points,
          color: r.color ?? "emerald",
          description: r.description ?? "",
          icon: r.icon ?? "Star",
          active: r.active ?? true,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
        set: {
          name: sql`excluded.name`,
          points: sql`excluded.points`,
          color: sql`excluded.color`,
          description: sql`excluded.description`,
          icon: sql`excluded.icon`,
          active: sql`excluded.active`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceDenomsForWorkspace(
  tenant: string,
  records: Denomination[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Denomination>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(hasanatDenoms).where(eq(hasanatDenoms.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(hasanatDenoms).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          points: r.points,
          color: r.color ?? "emerald",
          description: r.description ?? "",
          icon: r.icon ?? "Star",
          active: r.active ?? true,
          updatedAt: new Date(),
        })),
      );
    }
  });
}
