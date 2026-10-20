import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type MujtahidRep } from "@mms/shared";
import { mujtahidReps } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type MujtahidRepRow = typeof mujtahidReps.$inferSelect;

export function mujtahidRepRowToRecord(row: MujtahidRepRow): MujtahidRep {
  return {
    id: row.id,
    name: row.name,
    mujtahid_id: row.mujtahidId,
  };
}

export async function listMujtahidRepsByWorkspace(tenant: string): Promise<MujtahidRep[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: mujtahidReps.id,
        workspaceSubdomain: mujtahidReps.workspaceSubdomain,
        name: mujtahidReps.name,
        mujtahidId: mujtahidReps.mujtahidId,
        createdAt: mujtahidReps.createdAt,
        updatedAt: mujtahidReps.updatedAt,
      })
      .from(mujtahidReps)
      .where(eq(mujtahidReps.workspaceSubdomain, subdomain));
    return rows.map(mujtahidRepRowToRecord);
  });
}

export async function findMujtahidRepById(tenant: string, id: string): Promise<MujtahidRep | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: mujtahidReps.id,
        workspaceSubdomain: mujtahidReps.workspaceSubdomain,
        name: mujtahidReps.name,
        mujtahidId: mujtahidReps.mujtahidId,
        createdAt: mujtahidReps.createdAt,
        updatedAt: mujtahidReps.updatedAt,
      })
      .from(mujtahidReps)
      .where(and(eq(mujtahidReps.workspaceSubdomain, subdomain), eq(mujtahidReps.id, trimmedId)))
      .limit(1);
    const row = rows[0];
    return row ? mujtahidRepRowToRecord(row) : null;
  });
}

export async function findMujtahidRepsByIds(tenant: string, ids: string[]): Promise<MujtahidRep[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: mujtahidReps.id,
        workspaceSubdomain: mujtahidReps.workspaceSubdomain,
        name: mujtahidReps.name,
        mujtahidId: mujtahidReps.mujtahidId,
        createdAt: mujtahidReps.createdAt,
        updatedAt: mujtahidReps.updatedAt,
      })
      .from(mujtahidReps)
      .where(
        and(eq(mujtahidReps.workspaceSubdomain, subdomain), inArray(mujtahidReps.id, cleanIds)),
      );
    return rows.map(mujtahidRepRowToRecord);
  });
}

export async function saveMujtahidRep(tenant: string, record: MujtahidRep): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(mujtahidReps)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        mujtahidId: record.mujtahid_id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
        set: {
          name: record.name,
          mujtahidId: record.mujtahid_id,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveMujtahidReps(tenant: string, records: MujtahidRep[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, MujtahidRep>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(mujtahidReps)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          name: record.name,
          mujtahidId: record.mujtahid_id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
        set: {
          name: sql`excluded.name`,
          mujtahidId: sql`excluded.mujtahid_id`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceMujtahidRepsForWorkspace(
  tenant: string,
  records: MujtahidRep[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, MujtahidRep>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  const keepIds = uniqueRecords.map((r) => r.id);

  await withTenant(subdomain, async (tx) => {
    if (keepIds.length === 0) {
      await tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, subdomain));
    } else {
      await tx
        .delete(mujtahidReps)
        .where(
          and(eq(mujtahidReps.workspaceSubdomain, subdomain), notInArray(mujtahidReps.id, keepIds)),
        );

      await tx
        .insert(mujtahidReps)
        .values(
          uniqueRecords.map((record) => ({
            id: record.id,
            workspaceSubdomain: subdomain,
            name: record.name,
            mujtahidId: record.mujtahid_id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
          set: {
            name: sql`excluded.name`,
            mujtahidId: sql`excluded.mujtahid_id`,
            updatedAt: new Date(),
          },
        });
    }
  });
}
