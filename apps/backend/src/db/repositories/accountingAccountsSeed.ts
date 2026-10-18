import { eq, sql } from "drizzle-orm";
import type { Account } from "@mms/shared";
import { accountingAccounts } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { evictAccountingModulePreferencesCache } from "./accountingModulePreferencesRepository.js";
import { fillCashAccountIfEmpty, fillRetainedEarningsIfEmpty } from "./accountingSeedDefaults.js";

/** Seeded account ids to use for workspace settings that are still unset. */
export interface SeedAccountDefaults {
  retainedEarningsAccountId?: string;
  cashAccountId?: string;
}

export interface SeedDefaultsApplied {
  retainedEarnings: boolean;
  cashAccount: boolean;
}

export type SeedAccountsResult =
  | { seeded: true; count: number; defaultsApplied: SeedDefaultsApplied }
  | { seeded: false; existing: number };

/**
 * Inserts `records` only when the workspace has no account rows at all
 * (archived rows included, so a seed can never duplicate an archived code).
 *
 * The advisory lock serializes concurrent seeds for the same workspace: without
 * it, two requests could both read a zero count and both insert the chart.
 * Count, insert and the settings defaults share one transaction, so any failure
 * rolls back entirely. Defaults are filled only where the setting is still empty.
 */
export async function seedAccountsIfEmpty(
  tenant: string,
  records: Account[],
  defaults: SeedAccountDefaults = {},
): Promise<SeedAccountsResult> {
  const subdomain = tenant.trim().toLowerCase();
  const result = await withTenant(subdomain, async (tx): Promise<SeedAccountsResult> => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${subdomain}), hashtext('accounting:coa-seed'))`,
    );
    const existing = await tx.$count(
      accountingAccounts,
      eq(accountingAccounts.workspaceSubdomain, subdomain),
    );
    if (existing > 0) return { seeded: false, existing };
    if (records.length === 0)
      return {
        seeded: true,
        count: 0,
        defaultsApplied: { retainedEarnings: false, cashAccount: false },
      };

    const now = new Date();
    await tx.insert(accountingAccounts).values(
      records.map((record) => ({
        id: record.id,
        workspaceSubdomain: subdomain,
        code: record.code,
        name: record.name,
        type: record.type,
        subtype: record.subtype ?? "",
        description: record.description ?? "",
        isActive: record.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })),
    );
    const seededIds = new Set(records.map((record) => record.id));
    const retainedEarnings = defaults.retainedEarningsAccountId
      ? await fillRetainedEarningsIfEmpty(
          tx,
          subdomain,
          defaults.retainedEarningsAccountId,
          seededIds,
        )
      : false;
    const cashAccount = defaults.cashAccountId
      ? await fillCashAccountIfEmpty(tx, subdomain, defaults.cashAccountId)
      : false;
    return {
      seeded: true,
      count: records.length,
      defaultsApplied: { retainedEarnings, cashAccount },
    };
  });
  if (result.seeded && result.defaultsApplied.retainedEarnings) {
    await evictAccountingModulePreferencesCache(subdomain);
  }
  return result;
}
