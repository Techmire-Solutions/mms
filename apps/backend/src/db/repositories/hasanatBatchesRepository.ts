import { and, eq, inArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type StockBatch } from "@mms/shared";
import { hasanatBatches } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

type BatchRow = typeof hasanatBatches.$inferSelect;

export function batchRowToRecord(row: BatchRow): StockBatch {
  const batch: StockBatch = {
    id: row.id,
    denominationId: row.denominationId,
    denominationName: row.denominationName,
    quantity: row.quantity,
    remaining: row.remaining,
    addedDate: row.addedDate,
    note: row.note,
  };

  if (row.addedByUserId) batch.addedByUserId = row.addedByUserId;
  if (row.addedBy) batch.addedBy = row.addedBy;

  return batch;
}

export async function listBatchesByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<StockBatch[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatBatches.id,
        workspaceSubdomain: hasanatBatches.workspaceSubdomain,
        denominationId: hasanatBatches.denominationId,
        denominationName: hasanatBatches.denominationName,
        quantity: hasanatBatches.quantity,
        remaining: hasanatBatches.remaining,
        addedDate: hasanatBatches.addedDate,
        addedByUserId: hasanatBatches.addedByUserId,
        addedBy: hasanatBatches.addedBy,
        note: hasanatBatches.note,
        updatedAt: hasanatBatches.updatedAt,
        createdAt: hasanatBatches.createdAt,
      })
      .from(hasanatBatches)
      .where(eq(hasanatBatches.workspaceSubdomain, subdomain))
      .limit(limit)
      .offset(offset);
    return rows.map(batchRowToRecord);
  });
}

export async function findBatchById(tenant: string, id: string): Promise<StockBatch | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatBatches.id,
        workspaceSubdomain: hasanatBatches.workspaceSubdomain,
        denominationId: hasanatBatches.denominationId,
        denominationName: hasanatBatches.denominationName,
        quantity: hasanatBatches.quantity,
        remaining: hasanatBatches.remaining,
        addedDate: hasanatBatches.addedDate,
        addedByUserId: hasanatBatches.addedByUserId,
        addedBy: hasanatBatches.addedBy,
        note: hasanatBatches.note,
        updatedAt: hasanatBatches.updatedAt,
        createdAt: hasanatBatches.createdAt,
      })
      .from(hasanatBatches)
      .where(
        and(eq(hasanatBatches.workspaceSubdomain, subdomain), eq(hasanatBatches.id, trimmedId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? batchRowToRecord(row) : null;
  });
}

export async function findBatchesByIds(tenant: string, ids: string[]): Promise<StockBatch[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatBatches.id,
        workspaceSubdomain: hasanatBatches.workspaceSubdomain,
        denominationId: hasanatBatches.denominationId,
        denominationName: hasanatBatches.denominationName,
        quantity: hasanatBatches.quantity,
        remaining: hasanatBatches.remaining,
        addedDate: hasanatBatches.addedDate,
        addedByUserId: hasanatBatches.addedByUserId,
        addedBy: hasanatBatches.addedBy,
        note: hasanatBatches.note,
        updatedAt: hasanatBatches.updatedAt,
        createdAt: hasanatBatches.createdAt,
      })
      .from(hasanatBatches)
      .where(
        and(eq(hasanatBatches.workspaceSubdomain, subdomain), inArray(hasanatBatches.id, cleanIds)),
      );
    return rows.map(batchRowToRecord);
  });
}

export async function saveBatch(tenant: string, record: StockBatch): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatBatches)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        denominationId: record.denominationId,
        denominationName: record.denominationName ?? "",
        quantity: record.quantity,
        remaining: record.remaining ?? record.quantity,
        addedDate: record.addedDate,
        addedByUserId: record.addedByUserId ?? null,
        addedBy: record.addedBy ?? null,
        note: record.note ?? "",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [hasanatBatches.workspaceSubdomain, hasanatBatches.id],
        set: {
          denominationId: record.denominationId,
          denominationName: record.denominationName ?? "",
          quantity: record.quantity,
          remaining: record.remaining ?? record.quantity,
          addedDate: record.addedDate,
          addedByUserId: record.addedByUserId ?? null,
          addedBy: record.addedBy ?? null,
          note: record.note ?? "",
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveBatches(tenant: string, records: StockBatch[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, StockBatch>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(hasanatBatches)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          denominationId: r.denominationId,
          denominationName: r.denominationName ?? "",
          quantity: r.quantity,
          remaining: r.remaining ?? r.quantity,
          addedDate: r.addedDate,
          addedByUserId: r.addedByUserId ?? null,
          addedBy: r.addedBy ?? null,
          note: r.note ?? "",
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [hasanatBatches.workspaceSubdomain, hasanatBatches.id],
        set: {
          denominationId: sql`excluded.denomination_id`,
          denominationName: sql`excluded.denomination_name`,
          quantity: sql`excluded.quantity`,
          remaining: sql`excluded.remaining`,
          addedDate: sql`excluded.added_date`,
          addedByUserId: sql`excluded.added_by_user_id`,
          addedBy: sql`excluded.added_by`,
          note: sql`excluded.note`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceBatchesForWorkspace(
  tenant: string,
  records: StockBatch[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, StockBatch>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(hasanatBatches).where(eq(hasanatBatches.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(hasanatBatches).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          denominationId: r.denominationId,
          denominationName: r.denominationName ?? "",
          quantity: r.quantity,
          remaining: r.remaining ?? r.quantity,
          addedDate: r.addedDate,
          addedByUserId: r.addedByUserId ?? null,
          addedBy: r.addedBy ?? null,
          note: r.note ?? "",
          updatedAt: new Date(),
        })),
      );
    }
  });
}
