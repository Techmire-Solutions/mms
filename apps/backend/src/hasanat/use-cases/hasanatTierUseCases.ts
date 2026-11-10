/**
 * Hasanat tier & badge use cases.
 *
 * The displayed tier is always `resolveTier(current lifetime earned)`; awards are evidence that
 * this module materializes and reconciles. Reconciliation runs inside the transaction of every
 * mutation that changes lifetime earned points, so a retroactive adjustment cannot leave a stale
 * badge behind.
 */

import {
  evaluateTierChange,
  normalizeHasanatModulePreferences,
  tierProgress,
  type HasanatTier,
} from "@mms/shared";
import {
  findStudentsForCards,
  getHasanatModulePreferences,
  getStudentPoints,
  insertStudentAwards,
  listLiveStudentAwards,
  listStudentAwards,
  listTenantTierState,
  revokeStudentAwards,
  type NewAward,
} from "../repository/hasanatRepositoryAdapter.js";
import { auditAwardMutation } from "./hasanatAudit.js";

export interface HasanatStudentAwardView {
  id: string;
  tierKey: string;
  tierName: string;
  earnedSnapshot: number;
  awardedAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

export interface HasanatStudentSummary {
  studentId: string;
  /** Lifetime earned (tier basis) — optionally session-scoped. */
  earned: number;
  /** Value still available on active, non-deleted cards. */
  balance: number;
  /** Ledger net (redeems − reversals). */
  redeemed: number;
  tier: HasanatTier;
  nextTier: HasanatTier | null;
  pointsToNext: number;
  percentToNext: number;
  awards: HasanatStudentAwardView[];
}

export interface TierReconcileResult {
  students: number;
  awarded: number;
  revoked: number;
}

export async function loadHasanatTierLadder(tenant: string): Promise<HasanatTier[]> {
  const raw = await getHasanatModulePreferences(tenant.trim().toLowerCase());
  return normalizeHasanatModulePreferences(raw).tierLadder;
}

/** Student progression view: one points query + one awards query. */
export async function getHasanatStudentSummary(
  tenant: string,
  studentId: string,
  sessionId?: string | null,
): Promise<HasanatStudentSummary> {
  const subdomain = tenant.trim().toLowerCase();
  const [ladder, points, awards] = await Promise.all([
    loadHasanatTierLadder(subdomain),
    getStudentPoints(subdomain, studentId, sessionId),
    listStudentAwards(subdomain, studentId),
  ]);

  const progress = tierProgress(points.earned, ladder);
  return {
    studentId,
    earned: points.earned,
    balance: points.balance,
    redeemed: points.redeemed,
    tier: progress.tier,
    nextTier: progress.nextTier,
    pointsToNext: progress.pointsToNext,
    percentToNext: progress.percentToNext,
    awards: awards.map((award) => ({
      id: award.id,
      tierKey: award.tierKey,
      tierName: award.tierName,
      earnedSnapshot: award.earnedSnapshot,
      awardedAt: award.awardedAt,
      revokedAt: award.revokedAt ?? null,
      revokedReason: award.revokedReason ?? null,
    })),
  };
}

/**
 * Reconcile one student. Safe to call inside an existing transaction (all repository calls join
 * it), which is how issuance / batch award / delete / restore keep the badge consistent.
 */
export async function reconcileStudentTier(
  tenant: string,
  studentId: string,
  options: { actorUserId?: string | null } = {},
): Promise<{ awarded: number; revoked: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const [ladder, points, awards] = await Promise.all([
    loadHasanatTierLadder(subdomain),
    getStudentPoints(subdomain, studentId),
    listLiveStudentAwards(subdomain, studentId),
  ]);

  const plan = evaluateTierChange(points.earned, awards, ladder);

  let awarded = 0;
  let grantedAwardId: string | null = null;
  if (plan.award) {
    const inserted = await insertStudentAwards(subdomain, [
      {
        studentId,
        tierKey: plan.award.key,
        tierName: plan.award.name,
        earnedSnapshot: points.earned,
      },
    ]);
    awarded = inserted.length;
    grantedAwardId = inserted[0]?.id ?? null;
  }

  const revoked = await revokeStudentAwards(
    subdomain,
    plan.revoke.map((award) => award.id),
    "recalculated_after_reduction",
  );

  const now = new Date().toISOString();
  if (plan.award && grantedAwardId) {
    await auditAwardMutation({
      tenant: subdomain,
      actorUserId: options.actorUserId,
      action: "CREATE",
      award: {
        id: grantedAwardId,
        tierKey: plan.award.key,
        tierName: plan.award.name,
        earnedSnapshot: points.earned,
        awardedAt: now,
      },
      tag: "hasanat.tier.granted",
    });
  }
  for (const award of plan.revoke) {
    await auditAwardMutation({
      tenant: subdomain,
      actorUserId: options.actorUserId,
      action: "UPDATE",
      award: {
        id: award.id,
        tierKey: award.tierKey,
        tierName: award.tierName ?? "",
        earnedSnapshot: award.earnedSnapshot,
        awardedAt: award.awardedAt ?? now,
        revokedAt: now,
        revokedReason: "recalculated_after_reduction",
      },
      reason: "recalculated_after_reduction",
      tag: "hasanat.tier.revoked",
    });
  }

  return { awarded, revoked };
}

interface TierStateRow {
  studentId: string;
  earned: number;
  liveAwards: Array<{ id: string; tierKey: string }>;
}

/** Plans and applies awards/revocations for a fetched state set (one insert + one revoke batch). */
async function applyTierPlans(
  tenant: string,
  ladder: HasanatTier[],
  states: readonly TierStateRow[],
  actorUserId?: string | null,
): Promise<TierReconcileResult> {
  const toInsert: NewAward[] = [];
  const toRevoke: string[] = [];

  for (const state of states) {
    if (!state.studentId) continue;
    const plan = evaluateTierChange(state.earned, state.liveAwards, ladder);
    if (plan.award) {
      toInsert.push({
        studentId: state.studentId,
        tierKey: plan.award.key,
        tierName: plan.award.name,
        earnedSnapshot: state.earned,
      });
    }
    for (const revoked of plan.revoke) toRevoke.push(revoked.id);
  }

  const inserted = await insertStudentAwards(tenant, toInsert);
  const revoked = await revokeStudentAwards(tenant, toRevoke, "recalculated_after_reduction");

  // Award evidence is audited per record so a tier can never change without a hash-chained row.
  const now = new Date().toISOString();
  for (const award of inserted) {
    await auditAwardMutation({
      tenant,
      actorUserId,
      action: "CREATE",
      award: {
        id: award.id,
        tierKey: award.tierKey,
        tierName: award.tierName ?? "",
        earnedSnapshot: award.earnedSnapshot,
        awardedAt: now,
      },
      tag: "hasanat.tier.granted",
    });
  }
  if (toRevoke.length > 0) {
    const liveByeId = new Map<string, { tierKey: string }>();
    for (const state of states) {
      for (const award of state.liveAwards) liveByeId.set(award.id, { tierKey: award.tierKey });
    }
    for (const awardId of toRevoke) {
      const live = liveByeId.get(awardId);
      await auditAwardMutation({
        tenant,
        actorUserId,
        action: "UPDATE",
        award: {
          id: awardId,
          tierKey: live?.tierKey ?? "",
          tierName: "",
          earnedSnapshot: 0,
          awardedAt: now,
          revokedAt: now,
          revokedReason: "recalculated_after_reduction",
        },
        reason: "recalculated_after_reduction",
        tag: "hasanat.tier.revoked",
      });
    }
  }
  return { students: states.length, awarded: inserted.length, revoked };
}

/**
 * Reconcile a set of students with one state query and batched writes — the batch-award path must
 * never degrade into a per-student round-trip.
 */
export async function reconcileTiersForStudents(
  tenant: string,
  studentIds: readonly string[],
  options: { actorUserId?: string | null } = {},
): Promise<TierReconcileResult> {
  if (studentIds.length === 0) return { students: 0, awarded: 0, revoked: 0 };
  const subdomain = tenant.trim().toLowerCase();
  const ladder = await loadHasanatTierLadder(subdomain);
  const states = await listTenantTierState(subdomain, studentIds);
  return applyTierPlans(subdomain, ladder, states, options.actorUserId);
}

/** Reconcile the students who own the given cards (after a delete/restore). */
export async function reconcileTiersForCards(
  tenant: string,
  cardIds: readonly string[],
  options: { actorUserId?: string | null } = {},
): Promise<TierReconcileResult> {
  const subdomain = tenant.trim().toLowerCase();
  const studentIds = await findStudentsForCards(subdomain, cardIds);
  return reconcileTiersForStudents(subdomain, studentIds, options);
}

/** Tenant-wide reconciliation (admin backfill): one state query, batched writes. */
export async function reconcileTenantTiers(
  tenant: string,
  options: { actorUserId?: string | null } = {},
): Promise<TierReconcileResult> {
  const subdomain = tenant.trim().toLowerCase();
  const ladder = await loadHasanatTierLadder(subdomain);
  const states = await listTenantTierState(subdomain);
  return applyTierPlans(subdomain, ladder, states, options.actorUserId);
}

export * from "./hasanatStudentReadUseCases.js";
