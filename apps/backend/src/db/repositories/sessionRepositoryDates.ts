import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { normalizeSessionStatus, type Session } from "@mms/shared";
import { sessions } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { toDbDate } from "../../lib/dbDate.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { throwOverlapConflict } from "./sessionPersistErrors.js";

export interface SaveSessionOptions {
  /** Legacy OCC token: the millisecond `updatedAt` the caller read. */
  expectedUpdatedAt?: string;
  /** Preferred monotonic OCC token: `sessions.version`. */
  expectedVersion?: number;
  /** `preserve` (default) leaves the soft-delete sextuple untouched; `payload` mirrors it. */
  softDelete?: "preserve" | "payload";
  /** Actor stamped on `restored_at`/`restored_by` when a `payload` write clears `deleted_at`. */
  restoredBy?: string;
}

/**
 * A backup written before migration 0206 may contain overlapping live sessions. Restoring it must
 * not fail on the exclusion constraint, so the conflicting rows are restored as `overlap_exempt`
 * (visible and correctable) instead of aborting the whole restore.
 */
export async function overlapExemptForRestoreTx(
  tx: TenantTransaction,
  subdomain: string,
  record: Session,
): Promise<boolean> {
  if (record.overlapExempt) return true;
  if (!["draft", "open", "in_progress"].includes(normalizeSessionStatus(record.status)))
    return false;
  const start = toDbDate(record.startDate);
  const end = toDbDate(record.endDate);
  if (!start || !end) return false;
  const [conflict] = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.workspaceSubdomain, subdomain),
        isNull(sessions.deletedAt),
        eq(sessions.overlapExempt, false),
        inArray(sessions.status, ["draft", "open", "in_progress"]),
        isNotNull(sessions.startDate),
        isNotNull(sessions.endDate),
        sql`daterange(${sessions.startDate}, ${sessions.endDate}, '[]') && daterange(${start}::date, ${end}::date, '[]')`,
      ),
    )
    .limit(1);
  return Boolean(conflict);
}

/**
 * Targeted date update for `postpone`. Unlike `saveSession` (a whole-aggregate replacement),
 * this cannot lose a concurrent edit to classes/faculty and still honours the OCC token.
 */
export async function updateSessionDates(
  tenant: string,
  id: string,
  dates: { startDate: string | null; endDate: string | null },
  options?: SaveSessionOptions,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const changed = await withTenant(subdomain, async (tx) => {
    const scope = and(
      eq(sessions.workspaceSubdomain, subdomain),
      eq(sessions.id, id),
      isNull(sessions.deletedAt),
    );
    const [existing] = await tx
      .select({ updatedAt: sessions.updatedAt, version: sessions.version })
      .from(sessions)
      .where(scope)
      .for("update");
    if (!existing) return false;
    if (options?.expectedVersion !== undefined) {
      if (Number(existing.version) !== Number(options.expectedVersion))
        throw new ConflictError("This session was modified by another user — reload and try again");
    } else {
      const expected = options?.expectedUpdatedAt?.trim();
      if (expected && existing.updatedAt.toISOString() !== new Date(expected).toISOString())
        throw new ConflictError("This session was modified by another user — reload and try again");
    }
    try {
      await tx
        .update(sessions)
        .set({
          startDate: toDbDate(dates.startDate),
          endDate: toDbDate(dates.endDate),
          updatedAt: new Date(),
          version: sql`${sessions.version} + 1`,
        })
        .where(scope);
    } catch (error) {
      throwOverlapConflict(error);
    }
    return true;
  });
  if (changed) {
    await invalidateMultiTierCache({ tenantId: subdomain, domain: "sessions", key: id });
  }
  return changed;
}
