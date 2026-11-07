import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { sessionPromotionRunWarnings, sessionPromotionRuns } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

/** Run phases a retried job uses to resume instead of duplicating structure/staff/calendar. */
export interface PromotionRunPhases {
  id: string;
  status: string;
  targetSessionId: string | null;
  claimedAt: Date | null;
  structureCopiedAt: Date | null;
  staffCopiedAt: Date | null;
  calendarCopiedAt: Date | null;
}

/** Reads the run on the PRIMARY (control flow must not depend on a lagging replica). */
export async function findPromotionRunForUpdate(
  tenant: string,
  id: string,
): Promise<PromotionRunPhases | null> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenant(subdomain, (tx) =>
    tx
      .select({
        id: sessionPromotionRuns.id,
        status: sessionPromotionRuns.status,
        targetSessionId: sessionPromotionRuns.targetSessionId,
        claimedAt: sessionPromotionRuns.claimedAt,
        structureCopiedAt: sessionPromotionRuns.structureCopiedAt,
        staffCopiedAt: sessionPromotionRuns.staffCopiedAt,
        calendarCopiedAt: sessionPromotionRuns.calendarCopiedAt,
      })
      .from(sessionPromotionRuns)
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
        ),
      )
      .for("update"),
  );
  return row ?? null;
}

/** Claims a run for execution: queued, or a `running` attempt that went stale. */
export async function claimPromotionRun(tenant: string, id: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const result = await withTenant(subdomain, (tx) =>
    tx
      .update(sessionPromotionRuns)
      .set({ status: "running", claimedAt: new Date(), updatedAt: new Date(), error: null })
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
          or(
            eq(sessionPromotionRuns.status, "queued"),
            and(
              eq(sessionPromotionRuns.status, "running"),
              or(
                isNull(sessionPromotionRuns.claimedAt),
                lte(sessionPromotionRuns.claimedAt, new Date(Date.now() - 30 * 60 * 1000)),
              ),
            ),
          ),
        ),
      )
      .returning({ id: sessionPromotionRuns.id }),
  );
  return result.length > 0;
}

/** Marks abandoned queued/running runs failed so they stop blocking new rollovers. */
export async function failStaleRuns(tenant: string, olderThanMinutes = 30): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const rows = await withTenant(subdomain, (tx) =>
    tx
      .update(sessionPromotionRuns)
      .set({
        status: "failed",
        error: "Rollover timed out (stale run recovered)",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          inArray(sessionPromotionRuns.status, ["queued", "running"]),
          lte(sessionPromotionRuns.updatedAt, cutoff),
        ),
      )
      .returning({ id: sessionPromotionRuns.id }),
  );
  return rows.length;
}

/** Records a copy the rollover could not make (left faculty, unmapped calendar event, …). */
export async function recordRunWarning(
  tenant: string,
  runId: string,
  kind: string,
  detail: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx.insert(sessionPromotionRunWarnings).values({
      id: randomUUID(),
      workspaceSubdomain: subdomain,
      runId,
      kind,
      detail: detail.slice(0, 500),
    }),
  );
}

export interface PromotionRunWarning {
  kind: string;
  detail: string;
  createdAt: string;
}

export async function listRunWarnings(
  tenant: string,
  runId: string,
): Promise<PromotionRunWarning[]> {
  const subdomain = tenant.trim().toLowerCase();
  const rows = await withTenantRead(subdomain, (tx) =>
    tx
      .select({
        kind: sessionPromotionRunWarnings.kind,
        detail: sessionPromotionRunWarnings.detail,
        createdAt: sessionPromotionRunWarnings.createdAt,
      })
      .from(sessionPromotionRunWarnings)
      .where(
        and(
          eq(sessionPromotionRunWarnings.workspaceSubdomain, subdomain),
          eq(sessionPromotionRunWarnings.runId, runId),
        ),
      )
      .orderBy(sessionPromotionRunWarnings.createdAt),
  );
  return rows.map((row) => ({
    kind: row.kind,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Primary read of the persisted outcome counters (resume-safe audit totals). */
export async function readPromotionRunCounts(
  tenant: string,
  id: string,
): Promise<{ promoted: number; retained: number; graduated: number; left: number } | null> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenant(subdomain, (tx) =>
    tx
      .select({
        promoted: sessionPromotionRuns.promoted,
        retained: sessionPromotionRuns.retained,
        graduated: sessionPromotionRuns.graduated,
        left: sessionPromotionRuns.left,
      })
      .from(sessionPromotionRuns)
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
        ),
      ),
  );
  return row
    ? {
        promoted: Number(row.promoted),
        retained: Number(row.retained),
        graduated: Number(row.graduated),
        left: Number(row.left),
      }
    : null;
}
