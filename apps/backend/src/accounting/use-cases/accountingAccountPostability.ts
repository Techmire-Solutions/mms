import { ACCOUNTING_ERROR_CODES, dedupeTrimmedIds } from "@mms/shared";
import { ledgerError } from "./accountingLedgerErrors.js";
import type { JournalEntry } from "@mms/shared";

/**
 * Journal-line account postability: the account must exist, be active, not be
 * archived, and not be a header/summary account (one that has sub-accounts).
 *
 * Split out of `accountingLedgerGuards.ts` to keep that module inside the 300-line
 * ceiling; the guards module re-exports these so import sites are unchanged.
 */

/** The account fields a posting guard needs. */
export interface PostableAccountLike {
  id: string;
  isActive?: boolean;
  /** True when the account has active children — a header/summary row. */
  hasChildren?: boolean;
  /** When set, every line on the account must be in this currency (IAS 21). */
  accountCurrency?: string | null;
}

/**
 * Locking read of the accounts a journal line may target.
 *
 * Production wires this to `lockPostableAccounts`, which takes `FOR SHARE` on the
 * primary: the account archive/deactivate path holds `FOR UPDATE`, so the two
 * serialize instead of racing (a plain read in another transaction is insufficient).
 */
export type PostableAccountLoader = (
  tenant: string,
  accountIds: string[],
) => Promise<readonly PostableAccountLike[]>;

/**
 * Rejects any account id that cannot carry a journal line: unknown, archived,
 * deactivated, or a header/summary account that has sub-accounts (posting there
 * would be counted again by any rollup).
 */
export async function assertAccountIdsPostable(
  tenant: string,
  accountIds: readonly string[],
  loadAccounts: PostableAccountLoader,
): Promise<void> {
  const ids = dedupeTrimmedIds([...accountIds]);
  if (ids.length === 0) return;
  const byId = new Map((await loadAccounts(tenant, ids)).map((account) => [account.id, account]));
  const blocked = ids.flatMap((id) => {
    const account = byId.get(id);
    if (!account) return [`${id} (unknown or archived)`];
    if (account.isActive === false) return [`${id} (deactivated)`];
    if (account.hasChildren) return [`${id} (summary account with sub-accounts)`];
    return [];
  });
  if (blocked.length > 0) {
    throw ledgerError(
      `Journal lines reference accounts that cannot be posted to: ${blocked.join(", ")}`,
      ACCOUNTING_ERROR_CODES.accountNotPostable,
    );
  }
}

/**
 * Postability **and** the account's currency restriction, per line.
 *
 * The currency lock used to be enforced only by `resolveJournalFxLines`, which the
 * manual journal path calls; generated postings (invoices, payments, opening and
 * closing entries, FX/hedge entries) never went through it, so a USD document could
 * post a USD line to an account configured as PKR-only — and the period-end
 * revaluation would then retranslate a balance the account says it cannot hold.
 * A line that carries no `txn_currency` is treated as functional by the resolver and
 * is not judged here.
 */
export async function assertJournalAccountsWritable(
  tenant: string,
  entries: readonly JournalEntry[],
  loadAccounts: PostableAccountLoader,
): Promise<void> {
  const lines = entries.flatMap((entry) => entry.lines ?? []);
  await assertAccountIdsPostable(
    tenant,
    lines.map((line) => line.account_id),
    loadAccounts,
  );
  const ids = dedupeTrimmedIds(lines.map((line) => line.account_id));
  if (ids.length === 0) return;
  const byId = new Map((await loadAccounts(tenant, ids)).map((account) => [account.id, account]));
  const wrongCurrency = lines.flatMap((line) => {
    const locked = byId.get(line.account_id)?.accountCurrency?.trim().toUpperCase();
    const actual = line.txn_currency?.trim().toUpperCase();
    if (!locked || !actual || locked === actual) return [];
    return [`${line.account_id} (only accepts ${locked} lines, got ${actual})`];
  });
  if (wrongCurrency.length > 0) {
    throw ledgerError(
      `Journal lines reference accounts with a currency restriction: ${[...new Set(wrongCurrency)].join(", ")}`,
      ACCOUNTING_ERROR_CODES.accountCurrencyLocked,
    );
  }
}
