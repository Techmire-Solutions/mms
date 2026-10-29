import { and, eq, lte, sql } from "drizzle-orm";
import { AUDIT_RETENTION_FLOORS, type AuditRetentionRegime } from "@mms/shared";
import { withTenant, withTenantRead } from "../db/tenant-context.js";
import { cryptoShreddingKeys } from "../db/schema/auditTrail.js";
import { logger } from "../lib/logger.js";
import type { DbOrTransaction } from "./auditTrailService.js";

export interface RetentionPolicyEvaluation {
  regime: AuditRetentionRegime;
  retentionFloorDays: number;
  cutoffDate: Date;
  activeShreddedKeysEligibleForPurge: number;
}

/**
 * Evaluates retention policy for a given regulatory regime, scoped to one
 * workspace. Returns cutoff dates and counts of shredded keys eligible for purge.
 */
export async function evaluateAuditRetentionPolicy(
  regime: AuditRetentionRegime,
  tenant: string,
  asOfDate: Date = new Date(),
  executor?: DbOrTransaction,
): Promise<RetentionPolicyEvaluation> {
  const floorDays = AUDIT_RETENTION_FLOORS[regime];
  const cutoffDate = new Date(asOfDate.getTime() - floorDays * 24 * 60 * 60 * 1000);

  // Retention runs from when the key was SHREDDED (`destroyed_at`), not when it
  // was created: a key created years ago but shredded yesterday must still be
  // held for the full retention floor.
  const eligibleWhere = and(
    eq(cryptoShreddingKeys.workspaceSubdomain, tenant),
    eq(cryptoShreddingKeys.status, "SHREDDED"),
    lte(cryptoShreddingKeys.destroyedAt, cutoffDate),
  );

  let count: number;
  try {
    count = executor
      ? ((
          await executor
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(cryptoShreddingKeys)
            .where(eligibleWhere)
        )[0]?.count ?? 0)
      : await withTenantRead(tenant, async (db) => {
          const rows = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(cryptoShreddingKeys)
            .where(eligibleWhere);
          return rows[0]?.count ?? 0;
        });
  } catch {
    // Retention reporting must not break settings when the DB is unavailable.
    count = 0;
  }

  return {
    regime,
    retentionFloorDays: floorDays,
    cutoffDate,
    activeShreddedKeysEligibleForPurge: count,
  };
}

export interface PurgeExpiredKeysOptions {
  regime: AuditRetentionRegime;
  asOfDate?: Date;
  dryRun?: boolean;
}

/**
 * Automates policy-driven purging of shredded key metadata past the retention
 * floor. Scoped to the caller's workspace; key material is already destroyed.
 */
export async function purgeExpiredCryptoShreddingKeys(
  options: PurgeExpiredKeysOptions,
  tenant: string,
  executor?: DbOrTransaction,
): Promise<{ regime: AuditRetentionRegime; purgedCount: number; dryRun: boolean }> {
  const evaluation = await evaluateAuditRetentionPolicy(
    options.regime,
    tenant,
    options.asOfDate ?? new Date(),
    executor,
  );

  if (options.dryRun) {
    return {
      regime: options.regime,
      purgedCount: evaluation.activeShreddedKeysEligibleForPurge,
      dryRun: true,
    };
  }

  const count = await withTenant(tenant, async (db) => {
    const result = await db
      .delete(cryptoShreddingKeys)
      .where(
        and(
          eq(cryptoShreddingKeys.workspaceSubdomain, tenant),
          eq(cryptoShreddingKeys.status, "SHREDDED"),
          lte(cryptoShreddingKeys.destroyedAt, evaluation.cutoffDate),
        ),
      );
    return typeof result === "object" && result !== null && "rowCount" in result
      ? Number((result as { rowCount?: number }).rowCount ?? 0)
      : 0;
  });

  logger.info(
    { regime: options.regime, tenant, purgedCount: count, cutoffDate: evaluation.cutoffDate },
    "Policy-driven retention purge completed for shredded crypto keys",
  );

  return { regime: options.regime, purgedCount: count, dryRun: false };
}
