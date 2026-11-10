import { and, count, eq, inArray, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type StockBatch } from "@mms/shared";
import { hasanatBatches } from "../schema.js";
import { hasanatDistributions } from "../schema.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

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
      .orderBy(hasanatBatches.id)
      .limit(limit)
      .offset(offset);
    return rows.map(batchRowToRecord);
  });
}

export async function countBatchesByWorkspace(tenant: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ total: count() })
      .from(hasanatBatches)
      .where(eq(hasanatBatches.workspaceSubdomain, subdomain));
    return Number(row?.total ?? 0);
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
        addedDate: requireDbDateValue(record.addedDate, "addedDate"),
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
          // `remaining` is a DB-maintained projection (0225) — never written from the payload.
          addedDate: requireDbDateValue(record.addedDate, "addedDate"),
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
          addedDate: requireDbDateValue(r.addedDate, "addedDate"),
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
          addedDate: sql`excluded.added_date`,
          addedByUserId: sql`excluded.added_by_user_id`,
          addedBy: sql`excluded.added_by`,
          note: sql`excluded.note`,
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * Reconcile the batch list: upsert the rows in the payload and delete the rows it omits.
 *
 * Deletion is refused when the batch still has issued cards (the card rows are history). The old
 * delete-all-and-reinsert could never run once the distribution guard existed, and the upsert-only
 * variant silently ignored removals; this is the honest middle.
 */
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
    if (uniqueRecords.length > 0) {
      await tx
        .insert(hasanatBatches)
        .values(
          uniqueRecords.map((r) => ({
            id: r.id,
            workspaceSubdomain: subdomain,
            denominationId: r.denominationId,
            denominationName: r.denominationName ?? "",
            quantity: r.quantity,
            addedDate: requireDbDateValue(r.addedDate, "addedDate"),
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
            addedDate: sql`excluded.added_date`,
            addedByUserId: sql`excluded.added_by_user_id`,
            addedBy: sql`excluded.added_by`,
            note: sql`excluded.note`,
            updatedAt: new Date(),
          },
        });
    }

    const existing = await tx
      .select({ id: hasanatBatches.id })
      .from(hasanatBatches)
      .where(eq(hasanatBatches.workspaceSubdomain, subdomain));
    const incoming = new Set(uniqueRecords.map((row) => row.id));
    const missing = existing.map((row) => row.id).filter((id) => !incoming.has(id));
    if (missing.length === 0) return;

    const referenced = await tx
      .select({ id: hasanatDistributions.batchId })
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          inArray(hasanatDistributions.batchId, missing),
        ),
      )
      .groupBy(hasanatDistributions.batchId);
    if (referenced.length > 0) {
      throw new ConflictError(
        "Some batches still have issued cards and cannot be deleted.",
        "batch_in_use",
        { ids: referenced.map((row) => row.id) },
      );
    }

    await tx
      .delete(hasanatBatches)
      .where(
        and(eq(hasanatBatches.workspaceSubdomain, subdomain), inArray(hasanatBatches.id, missing)),
      );
  });
}
