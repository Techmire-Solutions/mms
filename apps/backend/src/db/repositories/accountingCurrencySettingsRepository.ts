import { and, eq, sql } from "drizzle-orm";
import { isIsoCurrencyCode, type AccountingCurrencySettings } from "@mms/shared";
import {
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingEntries,
  accountingPostingRules,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";

const FALLBACK_FUNCTIONAL_CURRENCY = "PKR";

/**
 * The currency a tenant has been booking in so far: the accounting preference,
 * then the finance preference, then PKR. Seeds the IAS 21 functional currency.
 */
export async function resolveDefaultFunctionalCurrency(
  tx: TenantTransaction,
  subdomain: string,
): Promise<string> {
  const { rows } = await tx.execute<{ accounting: string | null; finance: string | null }>(sql`
    SELECT
      (SELECT preferences->>'currency' FROM accounting_module_preferences
        WHERE workspace_subdomain = ${subdomain}) AS accounting,
      (SELECT preferences->>'currency' FROM finance_module_preferences
        WHERE workspace_subdomain = ${subdomain}) AS finance
  `);
  const candidates = [rows[0]?.accounting, rows[0]?.finance].map((code) =>
    code?.trim().toUpperCase(),
  );
  return (
    candidates.find((code): code is string => !!code && isIsoCurrencyCode(code)) ??
    FALLBACK_FUNCTIONAL_CURRENCY
  );
}

async function hasPostedEntries(tx: TenantTransaction, subdomain: string): Promise<boolean> {
  const rows = await tx
    .select({ id: accountingEntries.id })
    .from(accountingEntries)
    .where(
      and(eq(accountingEntries.workspaceSubdomain, subdomain), eq(accountingEntries.status, "posted")),
    )
    .limit(1);
  return rows.length > 0;
}

async function selectSettings(tx: TenantTransaction, subdomain: string) {
  const [row] = await tx
    .select({
      functionalCurrency: accountingCurrencySettings.functionalCurrency,
      presentationCurrency: accountingCurrencySettings.presentationCurrency,
      lockedAt: accountingCurrencySettings.lockedAt,
    })
    .from(accountingCurrencySettings)
    .where(eq(accountingCurrencySettings.workspaceSubdomain, subdomain));
  return row ?? null;
}

async function selectEnabledCurrencies(tx: TenantTransaction, subdomain: string) {
  const rows = await tx
    .select({ currency: accountingEnabledCurrencies.currency })
    .from(accountingEnabledCurrencies)
    .where(eq(accountingEnabledCurrencies.workspaceSubdomain, subdomain))
    .orderBy(accountingEnabledCurrencies.currency);
  return rows.map((row) => row.currency);
}

/**
 * The tenant's IAS 21 settings, created on first use (tenants provisioned after
 * migration 091 have no row yet). Runs inside the caller's transaction.
 */
export async function ensureCurrencySettingsInTx(
  tx: TenantTransaction,
  subdomain: string,
): Promise<AccountingCurrencySettings> {
  let row = await selectSettings(tx, subdomain);
  if (!row) {
    const currency = await resolveDefaultFunctionalCurrency(tx, subdomain);
    const locked = await hasPostedEntries(tx, subdomain);
    await tx
      .insert(accountingCurrencySettings)
      .values({
        workspaceSubdomain: subdomain,
        functionalCurrency: currency,
        presentationCurrency: currency,
        lockedAt: locked ? new Date() : null,
      })
      .onConflictDoNothing();
    row = await selectSettings(tx, subdomain);
  }
  if (!row) throw new Error(`Currency settings missing for ${subdomain}`);
  return {
    functionalCurrency: row.functionalCurrency,
    presentationCurrency: row.presentationCurrency,
    locked: row.lockedAt !== null || (await hasPostedEntries(tx, subdomain)),
    enabledCurrencies: await selectEnabledCurrencies(tx, subdomain),
  };
}

export async function getCurrencySettings(tenant: string): Promise<AccountingCurrencySettings> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, (tx) => ensureCurrencySettingsInTx(tx, subdomain));
}

/**
 * Save currency settings. The functional currency is immutable once anything
 * is posted (IAS 21.35 makes a change prospective, which needs its own
 * migration procedure); the caller has already validated that rule.
 */
export async function saveCurrencySettings(
  tenant: string,
  input: Omit<AccountingCurrencySettings, "locked">,
  userId: string | null,
): Promise<AccountingCurrencySettings> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    await tx
      .insert(accountingCurrencySettings)
      .values({
        workspaceSubdomain: subdomain,
        functionalCurrency: input.functionalCurrency,
        presentationCurrency: input.presentationCurrency,
        updatedBy: userId,
      })
      .onConflictDoUpdate({
        target: accountingCurrencySettings.workspaceSubdomain,
        set: {
          functionalCurrency: input.functionalCurrency,
          presentationCurrency: input.presentationCurrency,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      });
    await tx
      .delete(accountingEnabledCurrencies)
      .where(eq(accountingEnabledCurrencies.workspaceSubdomain, subdomain));
    const enabled = input.enabledCurrencies.filter((code) => code !== input.functionalCurrency);
    if (enabled.length > 0) {
      await tx
        .insert(accountingEnabledCurrencies)
        .values(enabled.map((currency) => ({ workspaceSubdomain: subdomain, currency })));
    }
    return ensureCurrencySettingsInTx(tx, subdomain);
  });
}

/** `accounting_posting_rules.fx_rounding_account_id`, or null when not configured. */
export async function findFxRoundingAccountId(tenant: string): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .select({ id: accountingPostingRules.fxRoundingAccountId })
      .from(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, subdomain));
    return row?.id ?? null;
  });
}
