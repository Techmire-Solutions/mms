/**
 * Hasanat tier/badge persistence — point totals and award rows.
 *
 * No rules here: the ladder, the target tier and what to revoke are decided by
 * `hasanatTierUseCases` with the pure `hasanatTierRules` helpers.
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { generateClientEntityId } from "@mms/shared";
import { hasanatDistributions, hasanatRedemptions, hasanatStudentAwards } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import {
  toAward,
  type AwardRow,
  type NewAward,
  type StudentPoints,
} from "./hasanatTierRepositoryTypes.js";

export * from "./hasanatTierRepositoryTypes.js";

/** One student's earned/balance/redeemed totals, optionally scoped to a session. */
export async function getStudentPoints(
  tenant: string,
  studentId: string,
  sessionId?: string | null,
): Promise<StudentPoints> {
  const subdomain = tenant.trim().toLowerCase();
  const sessionFilter = sessionId?.trim();

  return withTenantRead(subdomain, async (tx) => {
    const cardConditions = [
      eq(hasanatDistributions.workspaceSubdomain, subdomain),
      eq(hasanatDistributions.recipientStudentId, studentId),
      isNull(hasanatDistributions.deletedAt),
    ];
    if (sessionFilter) {
      cardConditions.push(eq(hasanatDistributions.sessionId, sessionFilter));
    }

    const [cards] = await tx
      .select({
        earned: sql<number>`coalesce(sum(${hasanatDistributions.pointsSnapshot}), 0)::int`,
        balance: sql<number>`coalesce(sum(${hasanatDistributions.pointsSnapshot}) filter (where ${hasanatDistributions.status} = 'active'), 0)::int`,
      })
      .from(hasanatDistributions)
      .where(and(...cardConditions));

    const ledgerConditions = [
      eq(hasanatRedemptions.workspaceSubdomain, subdomain),
      eq(hasanatRedemptions.studentId, studentId),
    ];

    const [ledger] = await tx
      .select({
        redeemed: sql<number>`coalesce(sum(case when ${hasanatRedemptions.kind} = 'reversal' then -${hasanatRedemptions.pointsUsed} else ${hasanatRedemptions.pointsUsed} end), 0)::int`,
      })
      .from(hasanatRedemptions)
      .where(and(...ledgerConditions));

    return {
      studentId,
      earned: Number(cards?.earned ?? 0),
      balance: Number(cards?.balance ?? 0),
      redeemed: Number(ledger?.redeemed ?? 0),
    };
  });
}

/** Award rows for one student, newest first (revoked rows included — they are evidence). */
export async function listStudentAwards(tenant: string, studentId: string): Promise<AwardRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatStudentAwards.id,
        tierKey: hasanatStudentAwards.tierKey,
        tierName: hasanatStudentAwards.tierName,
        earnedSnapshot: hasanatStudentAwards.earnedSnapshot,
        awardedAt: hasanatStudentAwards.awardedAt,
        revokedAt: hasanatStudentAwards.revokedAt,
        revokedReason: hasanatStudentAwards.revokedReason,
      })
      .from(hasanatStudentAwards)
      .where(
        and(
          eq(hasanatStudentAwards.workspaceSubdomain, subdomain),
          eq(hasanatStudentAwards.studentId, studentId),
        ),
      )
      .orderBy(desc(hasanatStudentAwards.awardedAt));
    return rows.map(toAward);
  });
}

/** Live (non-revoked) awards for one student. */
export async function listLiveStudentAwards(
  tenant: string,
  studentId: string,
): Promise<AwardRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: hasanatStudentAwards.id,
        tierKey: hasanatStudentAwards.tierKey,
        tierName: hasanatStudentAwards.tierName,
        earnedSnapshot: hasanatStudentAwards.earnedSnapshot,
        awardedAt: hasanatStudentAwards.awardedAt,
        revokedAt: hasanatStudentAwards.revokedAt,
        revokedReason: hasanatStudentAwards.revokedReason,
      })
      .from(hasanatStudentAwards)
      .where(
        and(
          eq(hasanatStudentAwards.workspaceSubdomain, subdomain),
          eq(hasanatStudentAwards.studentId, studentId),
          isNull(hasanatStudentAwards.revokedAt),
        ),
      )
      .orderBy(desc(hasanatStudentAwards.awardedAt));
    return rows.map(toAward);
  });
}

/** Insert awards (chunked). One transaction for the whole batch keeps the reconcile atomic. */
export async function insertStudentAwards(
  tenant: string,
  awards: readonly NewAward[],
): Promise<AwardRow[]> {
  if (awards.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const CHUNK = 200;
  const inserted: AwardRow[] = [];

  await withTenant(subdomain, async (tx) => {
    for (let index = 0; index < awards.length; index += CHUNK) {
      const chunk = awards.slice(index, index + CHUNK);
      const rows = await tx
        .insert(hasanatStudentAwards)
        .values(
          chunk.map((award) => ({
            id: generateClientEntityId("award"),
            workspaceSubdomain: subdomain,
            studentId: award.studentId,
            tierKey: award.tierKey,
            tierName: award.tierName,
            kind: "tier" as const,
            earnedSnapshot: award.earnedSnapshot,
            updatedAt: new Date(),
          })),
        )
        .returning();
      inserted.push(...rows.map(toAward));
    }
  });

  return inserted;
}

/** Revoke awards (never delete). Idempotent: already-revoked rows are skipped by the predicate. */
export async function revokeStudentAwards(
  tenant: string,
  awardIds: readonly string[],
  reason: string,
): Promise<number> {
  if (awardIds.length === 0) return 0;
  const subdomain = tenant.trim().toLowerCase();
  const CHUNK = 200;
  let revoked = 0;

  await withTenant(subdomain, async (tx) => {
    for (let index = 0; index < awardIds.length; index += CHUNK) {
      const chunk = awardIds.slice(index, index + CHUNK);
      const rows = await tx
        .update(hasanatStudentAwards)
        .set({ revokedAt: new Date(), revokedReason: reason, updatedAt: new Date() })
        .where(
          and(
            eq(hasanatStudentAwards.workspaceSubdomain, subdomain),
            inArray(hasanatStudentAwards.id, [...chunk]),
            isNull(hasanatStudentAwards.revokedAt),
          ),
        )
        .returning({ id: hasanatStudentAwards.id });
      revoked += rows.length;
    }
  });

  return revoked;
}

/**
 * Every student with cards or awards, their earned total and live award keys — one statement, used
 * by the tenant-wide reconcile (no per-student round-trip).
 */
export async function listTenantTierState(
  tenant: string,
  studentIds?: readonly string[],
): Promise<
  Array<{ studentId: string; earned: number; liveAwards: Array<{ id: string; tierKey: string }> }>
> {
  const subdomain = tenant.trim().toLowerCase();
  const filter =
    studentIds && studentIds.length > 0
      ? sql`AND recipient_student_id IN (${sql.join(
          studentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  const awardFilter =
    studentIds && studentIds.length > 0
      ? sql`AND student_id IN (${sql.join(
          studentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      WITH earned AS (
        SELECT recipient_student_id AS student_id,
               COALESCE(SUM(points_snapshot), 0)::int AS earned
          FROM hasanat_distributions
         WHERE workspace_subdomain = ${subdomain}
           AND deleted_at IS NULL
           AND recipient_student_id IS NOT NULL
           ${filter}
         GROUP BY recipient_student_id
      ),
      awards AS (
        SELECT student_id,
               jsonb_agg(jsonb_build_object('id', id, 'tierKey', tier_key) ORDER BY awarded_at) AS live_awards
          FROM hasanat_student_awards
         WHERE workspace_subdomain = ${subdomain}
           AND revoked_at IS NULL
           ${awardFilter}
         GROUP BY student_id
      )
      SELECT COALESCE(e.student_id, a.student_id) AS "studentId",
             COALESCE(e.earned, 0)::int AS "earned",
             COALESCE(a.live_awards, '[]'::jsonb) AS "liveAwards"
        FROM earned e
        FULL OUTER JOIN awards a ON a.student_id = e.student_id
       ORDER BY 1
    `);
    const rows = (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows.map((row) => ({
      studentId: String(row.studentId ?? ""),
      earned: Number(row.earned ?? 0),
      liveAwards: Array.isArray(row.liveAwards)
        ? (row.liveAwards as Array<{ id: string; tierKey: string }>).map((award) => ({
            id: String(award.id),
            tierKey: String(award.tierKey),
          }))
        : [],
    }));
  });
}

/** Student ids that own the given cards (used to reconcile after a delete/restore). */
export async function findStudentsForCards(
  tenant: string,
  cardIds: readonly string[],
): Promise<string[]> {
  if (cardIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx: TenantTransaction) => {
    const rows = await tx
      .select({ studentId: hasanatDistributions.recipientStudentId })
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          inArray(hasanatDistributions.id, [...cardIds]),
          sql`${hasanatDistributions.recipientStudentId} is not null`,
        ),
      )
      .orderBy(asc(hasanatDistributions.recipientStudentId));
    return Array.from(
      new Set(rows.map((row) => row.studentId).filter((id): id is string => Boolean(id))),
    );
  });
}
