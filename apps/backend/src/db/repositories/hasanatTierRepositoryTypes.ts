/**
 * Hasanat tier/badge persistence types & DTO mappers.
 */

import type { HasanatTierAward } from "@mms/shared";

export interface StudentPoints {
  studentId: string;
  /** Lifetime earned: every non-deleted card, redeemed or not (tier basis). */
  earned: number;
  /** Value still available on active, non-deleted cards. */
  balance: number;
  /** Ledger net: redeems minus reversals. */
  redeemed: number;
}

export interface AwardRow extends HasanatTierAward {
  id: string;
  studentId: string;
  tierName: string;
  earnedSnapshot: number;
  awardedAt: string;
}

export interface NewAward {
  studentId: string;
  tierKey: string;
  tierName: string;
  earnedSnapshot: number;
}

export function toAward(row: {
  id: string;
  studentId: string;
  tierKey: string;
  tierName: string;
  earnedSnapshot: number;
  awardedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}): AwardRow {
  return {
    id: row.id,
    studentId: row.studentId,
    tierKey: row.tierKey,
    tierName: row.tierName,
    earnedSnapshot: row.earnedSnapshot,
    awardedAt: row.awardedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokedReason: row.revokedReason ?? null,
  };
}
