/**
 * Migration 091: IAS 21 expand-phase backfill (pairs with SQL 0185).
 *
 * Per tenant, in one transaction:
 *   1. seed `accounting_currency_settings` from the accounting preference
 *      (falling back to finance, then PKR), locked when posted entries exist;
 *   2. classify `is_monetary` on the chart of accounts (first run only);
 *   3. copy `debit`/`credit` into `txn_*` / `func_*` at rate 1 in batches;
 *   4. assert the per-account trial balance is unchanged, else roll back.
 *
 * Idempotent and resumable: only rows with `func_debit IS NULL` are touched.
 */
import { sql } from "drizzle-orm";
import { inferIsMonetaryAccount } from "@mms/shared";
import { resolveDefaultFunctionalCurrency } from "../repositories/accountingCurrencySettingsRepository.js";
import { withGlobalTenant, withTenant, type TenantTransaction } from "../tenant-context.js";

const BATCH_SIZE = 5000;

interface BalanceRow extends Record<string, unknown> {
  account_id: string;
  balance: string;
}

async function trialBalance(tx: TenantTransaction, tenant: string, useFunc: boolean) {
  const { rows } = useFunc
    ? await tx.execute<BalanceRow>(sql`
        SELECT account_id, (SUM(func_debit) - SUM(func_credit))::text AS balance
        FROM accounting_journal_lines WHERE workspace_subdomain = ${tenant}
        GROUP BY account_id ORDER BY account_id`)
    : await tx.execute<BalanceRow>(sql`
        SELECT account_id, (SUM(debit) - SUM(credit))::text AS balance
        FROM accounting_journal_lines WHERE workspace_subdomain = ${tenant}
        GROUP BY account_id ORDER BY account_id`);
  return new Map(rows.map((row) => [row.account_id, Number(row.balance).toFixed(2)]));
}

async function classifyAccounts(tx: TenantTransaction, tenant: string): Promise<void> {
  const { rows } = await tx.execute<{ id: string; type: string; subtype: string; name: string }>(
    sql`SELECT id, type, subtype, name FROM accounting_accounts WHERE workspace_subdomain = ${tenant}`,
  );
  const monetaryIds = rows.filter((row) => inferIsMonetaryAccount(row)).map((row) => row.id);
  if (monetaryIds.length === 0) return;
  await tx.execute(sql`
    UPDATE accounting_accounts SET is_monetary = true
    WHERE workspace_subdomain = ${tenant}
      AND id IN (${sql.join(monetaryIds.map((id) => sql`${id}`), sql`, `)})`);
}

async function backfillLines(tx: TenantTransaction, tenant: string, currency: string) {
  for (;;) {
    const result = await tx.execute(sql`
      UPDATE accounting_journal_lines l
      SET txn_currency = ${currency}, txn_debit = l.debit, txn_credit = l.credit,
          exchange_rate = 1, rate_type = 'SPOT', rate_date = e.date,
          func_debit = l.debit, func_credit = l.credit
      FROM accounting_entries e
      WHERE e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
        AND (l.workspace_subdomain, l.entry_id, l.id) IN (
          SELECT workspace_subdomain, entry_id, id FROM accounting_journal_lines
          WHERE workspace_subdomain = ${tenant} AND func_debit IS NULL
          LIMIT ${BATCH_SIZE})`);
    if ((result.rowCount ?? 0) < BATCH_SIZE) break;
  }
  await tx.execute(sql`
    UPDATE accounting_opening_balances
    SET txn_currency = ${currency}, txn_debit = debit, txn_credit = credit,
        exchange_rate = 1, rate_type = 'SPOT',
        func_debit = debit, func_credit = credit
    WHERE workspace_subdomain = ${tenant} AND func_debit IS NULL`);
}

async function backfillTenant(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    const currency = await resolveDefaultFunctionalCurrency(tx, tenant);
    const inserted = await tx.execute(sql`
      INSERT INTO accounting_currency_settings
        (workspace_subdomain, functional_currency, presentation_currency, locked_at)
      VALUES (${tenant}, ${currency}, ${currency},
        CASE WHEN EXISTS (SELECT 1 FROM accounting_entries
          WHERE workspace_subdomain = ${tenant} AND status = 'posted') THEN now() END)
      ON CONFLICT (workspace_subdomain) DO NOTHING`);
    if ((inserted.rowCount ?? 0) > 0) await classifyAccounts(tx, tenant);

    const { rows } = await tx.execute<{ functional_currency: string }>(sql`
      SELECT functional_currency FROM accounting_currency_settings
      WHERE workspace_subdomain = ${tenant}`);
    const functional = rows[0]?.functional_currency ?? currency;

    const before = await trialBalance(tx, tenant, false);
    await backfillLines(tx, tenant, functional);
    const after = await trialBalance(tx, tenant, true);
    for (const [accountId, balance] of before) {
      if (after.get(accountId) !== balance) {
        throw new Error(
          `Migration 091: trial balance changed for ${tenant}/${accountId} (${balance} → ${after.get(accountId)})`,
        );
      }
    }
  });
}

export async function runMigration091(): Promise<void> {
  console.log("Backfilling IAS 21 functional currency and dual ledger amounts...");
  const tenants = await withGlobalTenant(async (tx) =>
    (
      await tx.execute<{ subdomain: string }>(
        sql`SELECT subdomain FROM workspaces ORDER BY subdomain`,
      )
    ).rows.map((row) => row.subdomain),
  );
  for (const tenant of tenants) await backfillTenant(tenant);
  console.log(`Backfilled functional currency for ${tenants.length} workspace(s).`);
}
