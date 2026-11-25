import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { SessionRolloverRun } from "@mms/contracts";
import { enrollments, sessionPromotionClassMap, sessionPromotionRuns } from "@mms/db/schema";
import { withTenant, withTenantRead } from "@mms/db/context";
import { isUniqueViolation } from "@mms/be-core/http/errors";

/** Patch shape for a run, including the execution phases (migration 0207). */
export type PromotionRunPatch = Partial<
  Omit<SessionRolloverRun, "id" | "sourceSessionId" | "mode"> & {
    claimedAt: Date | null;
    structureCopiedAt: Date | null;
    staffCopiedAt: Date | null;
    calendarCopiedAt: Date | null;
  }
>;

const RUN_COLUMNS = {
  id: sessionPromotionRuns.id,
  sourceSessionId: sessionPromotionRuns.sourceSessionId,
  targetSessionId: sessionPromotionRuns.targetSessionId,
  mode: sessionPromotionRuns.mode,
  status: sessionPromotionRuns.status,
  promoted: sessionPromotionRuns.promoted,
  retained: sessionPromotionRuns.retained,
  graduated: sessionPromotionRuns.graduated,
  left: sessionPromotionRuns.left,
  error: sessionPromotionRuns.error,
  jobId: sessionPromotionRuns.jobId,
};

const toRun = (
  row: { mode: string; status: string } & Omit<SessionRolloverRun, "mode" | "status">,
) => row as SessionRolloverRun;

/**
 * Creates a run unless one is already queued/running for the same source. The advisory lock
 * serialises concurrent starts so two clicks cannot create two target sessions and promote the
 * same students twice.
 */
export async function createPromotionRun(
  tenant: string,
  run: {
    id: string;
    sourceSessionId: string;
    mode: "duplicate" | "promote";
    classMap: readonly { sourceClassId: string; nextClassId: string | null }[];
    createdBy: string;
  },
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:rollover:${run.sourceSessionId}`}))`,
    );
    const [active] = await tx
      .select({ id: sessionPromotionRuns.id })
      .from(sessionPromotionRuns)
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.sourceSessionId, run.sourceSessionId),
          inArray(sessionPromotionRuns.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (active) return false;
    try {
      await tx.insert(sessionPromotionRuns).values({
        id: run.id,
        workspaceSubdomain: subdomain,
        sourceSessionId: run.sourceSessionId,
        mode: run.mode,
        createdBy: run.createdBy,
      });
      if (run.classMap.length > 0)
        await tx.insert(sessionPromotionClassMap).values(
          run.classMap.map((row: any) => ({
            workspaceSubdomain: subdomain,
            runId: run.id,
            sourceClassId: row.sourceClassId,
            nextClassId: row.nextClassId,
          })),
        );
    } catch (error) {
      // The partial unique index (migration 0207) is the database backstop for concurrent starts.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
    return true;
  });
}

export async function updatePromotionRun(
  tenant: string,
  id: string,
  patch: PromotionRunPatch,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx
      .update(sessionPromotionRuns)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
        ),
      ),
  );
}

export async function findPromotionRun(
  tenant: string,
  id: string,
): Promise<SessionRolloverRun | null> {
  const subdomain = tenant.trim().toLowerCase();
  const [row] = await withTenantRead(subdomain, (tx) =>
    tx
      .select(RUN_COLUMNS)
      .from(sessionPromotionRuns)
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
        ),
      ),
  );
  return row ? toRun(row) : null;
}

export async function listPromotionRuns(
  tenant: string,
  sourceSessionId: string,
): Promise<SessionRolloverRun[]> {
  const subdomain = tenant.trim().toLowerCase();
  const rows = await withTenantRead(subdomain, (tx) =>
    tx
      .select(RUN_COLUMNS)
      .from(sessionPromotionRuns)
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.sourceSessionId, sourceSessionId),
        ),
      )
      .orderBy(desc(sessionPromotionRuns.createdAt))
      .limit(20),
  );
  return rows.map(toRun);
}

/** Source enrollments already carried into the target session (re-runs skip them). */
export async function findPromotedSourceIds(
  tenant: string,
  targetSessionId: string,
  sourceEnrollmentIds: readonly string[],
): Promise<Set<string>> {
  if (sourceEnrollmentIds.length === 0) return new Set();
  const subdomain = tenant.trim().toLowerCase();
  // PRIMARY read: a retry must see the rows this run just wrote, not a lagging replica.
  const rows = await withTenant(subdomain, (tx) =>
    tx
      .select({ from: enrollments.promotedFromEnrollmentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, targetSessionId),
          isNull(enrollments.deletedAt),
          isNotNull(enrollments.promotedFromEnrollmentId),
          inArray(enrollments.promotedFromEnrollmentId, [...sourceEnrollmentIds]),
        ),
      ),
  );
  return new Set(rows.map((row: any) => String(row.from)));
}

/**
 * Sets the run's outcome counters to absolute totals (idempotent). The rollover job computes the
 * complete count from the full plan in memory on every attempt, so a resume re-sets the same value
 * instead of double-counting (the previous `+ delta` semantics were only safe because each student
 * was incremented once under the `!alreadyCarried` guard).
 */
export async function setPromotionRunCounts(
  tenant: string,
  id: string,
  counts: Partial<Record<"promoted" | "retained" | "graduated" | "left", number>>,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx
      .update(sessionPromotionRuns)
      .set({
        promoted: Math.trunc(counts.promoted ?? 0),
        retained: Math.trunc(counts.retained ?? 0),
        graduated: Math.trunc(counts.graduated ?? 0),
        left: Math.trunc(counts.left ?? 0),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionPromotionRuns.workspaceSubdomain, subdomain),
          eq(sessionPromotionRuns.id, id),
        ),
      ),
  );
}
