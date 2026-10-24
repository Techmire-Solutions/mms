import { eq, sql } from "drizzle-orm";
import { normalizeAccountingModulePreferences } from "@mms/shared";
import { accountingModulePreferences, accountingPostingRules } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Sets the posting-rules cash account only when it is unset. `COALESCE` keeps any
 * existing value, so the returned id equals `cashAccountId` only when this call filled it.
 */
export async function fillCashAccountIfEmpty(
  tx: TenantTransaction,
  subdomain: string,
  cashAccountId: string,
): Promise<boolean> {
  const now = new Date();
  const rows = await tx
    .insert(accountingPostingRules)
    .values({ workspaceSubdomain: subdomain, cashAccountId, updatedAt: now })
    .onConflictDoUpdate({
      target: accountingPostingRules.workspaceSubdomain,
      set: {
        cashAccountId: sql`coalesce(accounting_posting_rules.cash_account_id, excluded.cash_account_id)`,
        updatedAt: now,
      },
    })
    .returning({ cashAccountId: accountingPostingRules.cashAccountId });
  return rows[0]?.cashAccountId === cashAccountId;
}

/**
 * Sets `retainedEarningsAccount` in the module preferences only when it is empty:
 * blank, or pointing at an account that does not exist. The built-in default
 * (`a3100`) never resolves in a freshly seeded workspace, so it counts as empty.
 * Other preference keys are left untouched.
 */
export async function fillRetainedEarningsIfEmpty(
  tx: TenantTransaction,
  subdomain: string,
  retainedEarningsAccountId: string,
  existingAccountIds: ReadonlySet<string>,
): Promise<boolean> {
  const rows = await tx
    .select({ preferences: accountingModulePreferences.preferences })
    .from(accountingModulePreferences)
    .where(eq(accountingModulePreferences.workspaceSubdomain, subdomain))
    .limit(1);
  const stored = rows[0]?.preferences;
  const current =
    typeof stored?.retainedEarningsAccount === "string"
      ? stored.retainedEarningsAccount.trim()
      : "";
  if (current && existingAccountIds.has(current)) return false;

  const now = new Date();
  if (stored) {
    await tx
      .update(accountingModulePreferences)
      .set({
        preferences: sql`jsonb_set(preferences, '{retainedEarningsAccount}', to_jsonb(${retainedEarningsAccountId}::text), true)`,
        updatedAt: now,
      })
      .where(eq(accountingModulePreferences.workspaceSubdomain, subdomain));
  } else {
    await tx.insert(accountingModulePreferences).values({
      workspaceSubdomain: subdomain,
      preferences: {
        ...normalizeAccountingModulePreferences(null),
        retainedEarningsAccount: retainedEarningsAccountId,
      },
      updatedAt: now,
    });
  }
  return true;
}
