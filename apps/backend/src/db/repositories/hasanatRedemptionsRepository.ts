import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Redemption } from "@mms/shared";
import { redemptionColumns } from "./hasanatColumns.js";
import {
  hasanatDenoms,
  hasanatBatches,
  hasanatDistributions,
  hasanatRedemptions,
} from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

type RedempRow = typeof hasanatRedemptions.$inferSelect;

export function redemptionRowToRecord(row: RedempRow): Redemption {
  const redemption: Redemption = {
    id: row.id,
    distributionId: row.distributionId,
    studentName: row.studentName ?? "",
    reward: row.reward,
    pointsUsed: row.pointsUsed,
    kind: row.kind as Redemption["kind"],
    date: row.date,
  };

  if (row.studentId) redemption.studentId = row.studentId;
  if (row.reversalOfId) redemption.reversalOfId = row.reversalOfId;
  if (row.approvedByUserId) redemption.approvedByUserId = row.approvedByUserId;
  if (row.approvedBy) redemption.approvedBy = row.approvedBy;

  return redemption;
}

export async function listRedemptionsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<Redemption[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 1000, 1), 10000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      // A trashed card must stop contributing to the redemption tracker.
      .innerJoin(
        hasanatDistributions,
        and(
          eq(hasanatDistributions.workspaceSubdomain, hasanatRedemptions.workspaceSubdomain),
          eq(hasanatDistributions.id, hasanatRedemptions.distributionId),
        ),
      )
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          isNull(hasanatDistributions.deletedAt),
        ),
      )
      .orderBy(hasanatRedemptions.id)
      .limit(limit)
      .offset(offset);
    return rows.map(redemptionRowToRecord);
  });
}

export async function findRedemptionById(tenant: string, id: string): Promise<Redemption | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          eq(hasanatRedemptions.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? redemptionRowToRecord(row) : null;
  });
}

export async function findRedemptionsByIds(tenant: string, ids: string[]): Promise<Redemption[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(redemptionColumns)
      .from(hasanatRedemptions)
      .where(
        and(
          eq(hasanatRedemptions.workspaceSubdomain, subdomain),
          inArray(hasanatRedemptions.id, cleanIds),
        ),
      );
    return rows.map(redemptionRowToRecord);
  });
}

export async function replaceRedemptionsForWorkspace(
  tenant: string,
  records: Redemption[],
  options: { allowHardPurge?: boolean } = {},
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Redemption>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    if (options.allowHardPurge) {
      await tx.execute(sql`SELECT set_config('app.allow_hard_purge', 'true', true)`);
    }
    // Backup-restore path only; the caller sets `app.allow_hard_purge` for the ledger guard.
    await tx.delete(hasanatRedemptions).where(eq(hasanatRedemptions.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(hasanatRedemptions).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          distributionId: r.distributionId,
          studentId: r.studentId ?? null,
          studentName: r.studentName ?? "",
          reward: r.reward,
          pointsUsed: r.pointsUsed ?? 0,
          date: requireDbDateValue(r.date, "date"),
          approvedByUserId: r.approvedByUserId ?? null,
          approvedBy: r.approvedBy ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function deleteHasanatByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(hasanatRedemptions).where(eq(hasanatRedemptions.workspaceSubdomain, subdomain));
    await tx
      .delete(hasanatDistributions)
      .where(eq(hasanatDistributions.workspaceSubdomain, subdomain));
    await tx.delete(hasanatBatches).where(eq(hasanatBatches.workspaceSubdomain, subdomain));
    await tx.delete(hasanatDenoms).where(eq(hasanatDenoms.workspaceSubdomain, subdomain));
  });
}
