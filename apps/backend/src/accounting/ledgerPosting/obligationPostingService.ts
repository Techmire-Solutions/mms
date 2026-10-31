/**
 * @file obligationPostingService.ts
 * @description Orchestrates double-entry general ledger posting for Obligation Collections.
 */

import {
  buildObligationPostingLines,
  buildObligationRevisionKey,
  type ObligationCollection,
  type ObligationDistributionRule,
} from "@mms/shared";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listAccountsByWorkspace } from "../../db/repositories/accountingAccountsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import { listWakalaTypesByWorkspace } from "../../db/repositories/obligationWakalaRepository.js";
import { listObligationDistributionsByWorkspace } from "../../db/repositories/obligationDistributionsRepository.js";
import { logger } from "../../lib/logger.js";
import {
  entryForSource,
  persistGeneratedEntry,
  postingDate,
  resolveYearId,
} from "./ledgerPostingHelpers.js";
import {
  tryPostArchiveReversalJournal,
  tryPostRestoreJournal,
  tryPostReversalOfSource,
} from "./ledgerReversalPostingService.js";
import {
  findLatestObligationPosting,
  obligationEntrySourceId,
} from "./obligationPostingSources.js";

interface ResolvedPostingAccounts {
  knownAccountIds: ReadonlySet<string>;
  cashAccountId: string | null;
  bankAccountId: string | null;
  incomeAccountId: string | null;
  liabilityAccountId: string | null;
}

/**
 * Reads the workspace posting configuration, falling back to canonical chart accounts.
 */
async function resolvePostingAccounts(tenant: string): Promise<ResolvedPostingAccounts | null> {
  let [rules, accounts] = await Promise.all([
    getPostingRules(tenant),
    listAccountsByWorkspace(tenant),
  ]);
  if (accounts.length === 0) {
    try {
      const {
        DEFAULT_CHART_OF_ACCOUNTS,
        DEFAULT_CHART_RETAINED_EARNINGS_CODE,
        DEFAULT_CHART_CASH_ACCOUNT_CODE,
      } = await import("@mms/shared");
      const { randomUUID } = await import("node:crypto");
      const { seedAccountsIfEmpty } =
        await import("../../db/repositories/accountingAccountsSeed.js");
      const records = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
        ...a,
        id: `a${randomUUID()}`,
        isActive: true,
      }));
      const idByCode = new Map(records.map((r) => [r.code, r.id]));
      await seedAccountsIfEmpty(tenant, records, {
        retainedEarningsAccountId: idByCode.get(DEFAULT_CHART_RETAINED_EARNINGS_CODE),
        cashAccountId: idByCode.get(DEFAULT_CHART_CASH_ACCOUNT_CODE),
      });
      accounts = await listAccountsByWorkspace(tenant);
      rules = await getPostingRules(tenant);
    } catch {
      // In isolated tests or offline runs, fail closed cleanly
    }
  }
  if (accounts.length === 0) return null;

  const cashAccount = rules.cashAccountId
    ? accounts.find((a) => a.id === rules.cashAccountId)
    : null;
  const bankAccount = rules.bankAccountId
    ? accounts.find((a) => a.id === rules.bankAccountId)
    : rules.cashAccountId
      ? (accounts.find((a) => a.code === "10300") ??
        accounts.find((a) => a.subtype?.toLowerCase() === "bank"))
      : null;
  const incomeAccount =
    accounts.find((a) => a.id === rules.incomeAccountId) ??
    accounts.find((a) => a.code === "41000") ??
    accounts.find((a) => a.code === "40100") ??
    accounts.find((a) => a.type === "Revenue");
  const liabilityAccount =
    accounts.find((a) => a.code === "21100") ??
    accounts.find((a) => a.code === "20100") ??
    accounts.find((a) => a.type === "Liability");

  return {
    knownAccountIds: new Set(accounts.map((a) => a.id)),
    cashAccountId: cashAccount?.id ?? null,
    bankAccountId: bankAccount?.id ?? null,
    incomeAccountId: incomeAccount?.id ?? null,
    liabilityAccountId: liabilityAccount?.id ?? null,
  };
}

/** Loads the distribution rules of the wakala that governs this collection. */
async function resolveDistributionRules(
  tenant: string,
  collection: ObligationCollection,
): Promise<ObligationDistributionRule[]> {
  const wakalas = await listWakalaTypesByWorkspace(tenant);
  const wakala = wakalas.find(
    (candidate) =>
      candidate.obligation_type_id === collection.obligation_type_id &&
      candidate.mujtahid_representative_id === collection.mujtahid_representative_id,
  );
  if (!wakala) return [];
  const distributions = await listObligationDistributionsByWorkspace(tenant);
  return distributions
    .filter((distribution) => distribution.wakala_type_id === wakala.id)
    .map((distribution) => ({
      id: distribution.id,
      name: distribution.name,
      percentage: distribution.percentage,
      type: distribution.type,
      accountId: distribution.account_id,
    }));
}

function broadcastLedgerChange(tenant: string): void {
  void import("../../lib/livePush.js")
    .then(({ broadcastTenantUpdate }) =>
      broadcastTenantUpdate(tenant, "collection", "accounting_entries"),
    )
    .catch((error: unknown) => {
      logger.warn({ err: error, tenant }, "Obligation ledger live-push broadcast failed");
    });
}

/** Posts Dr Cash/Bank / Cr Wakala Distributions under the given posting epoch. */
async function postObligationEntry(
  tenant: string,
  collection: ObligationCollection,
  epoch: number,
): Promise<void> {
  const accounts = await resolvePostingAccounts(tenant);
  if (!accounts) {
    logger.info(
      { tenant, collectionId: collection.id },
      "Obligation ledger posting skipped: workspace has no chart of accounts",
    );
    return;
  }

  const distributions = await resolveDistributionRules(tenant, collection);
  const date = postingDate(collection.received_date);
  const description = `Obligation Receipt ${collection.receipt_no}`;
  const lines = buildObligationPostingLines({
    collectionId: collection.id,
    receiptNo: collection.receipt_no,
    amount: collection.amount,
    date,
    paymentMode: collection.payment_mode,
    description,
    distributions,
    cashAccountId: accounts.cashAccountId,
    bankAccountId: accounts.bankAccountId,
    defaultIncomeAccountId: accounts.incomeAccountId,
    defaultLiabilityAccountId: accounts.liabilityAccountId,
    knownAccountIds: accounts.knownAccountIds,
  });

  if (!lines) {
    logger.info(
      { tenant, collectionId: collection.id, distributionCount: distributions.length },
      "Obligation ledger posting skipped: posting accounts are not fully configured",
    );
    return;
  }

  const years = await listFiscalYearsByWorkspace(tenant);
  const entry = entryForSource(
    "obligation",
    obligationEntrySourceId(collection.id, epoch),
    date,
    description,
    lines,
    resolveYearId(years, date),
  );
  entry.ref = collection.receipt_no;

  await persistGeneratedEntry(tenant, entry, years);
  broadcastLedgerChange(tenant);
}

/**
 * Posts a newly created obligation collection.
 *
 * No-op when the collection already has a posting, which keeps a replayed
 * create from double-counting the receipt.
 */
export async function tryPostObligationJournal(
  tenant: string,
  collection: ObligationCollection,
): Promise<void> {
  if (collection.deletedAt || collection.amount <= 0) return;
  const latest = await findLatestObligationPosting(tenant, collection.id);
  if (latest) return;
  await postObligationEntry(tenant, collection, 0);
}

/**
 * Brings the ledger in line with a saved collection, correcting a stale entry.
 *
 * `previous` is the record as it stood before the write. When a posting-
 * relevant field changed, the entry on the books is reversed and a corrected
 * one posts under the next epoch, so an edited receipt never leaves the old
 * amount in the accounts. An unchanged save does nothing.
 */
export async function syncObligationJournal(
  tenant: string,
  collection: ObligationCollection,
  previous?: ObligationCollection | null,
): Promise<void> {
  if (collection.deletedAt || collection.amount <= 0) return;

  if (previous && !previous.deletedAt) {
    if (buildObligationRevisionKey(previous) === buildObligationRevisionKey(collection)) return;
  }

  const latest = await findLatestObligationPosting(tenant, collection.id);
  if (!latest) {
    await postObligationEntry(tenant, collection, 0);
    return;
  }
  if (!previous) return;

  await tryPostReversalOfSource(
    tenant,
    "obligation",
    latest.sourceId,
    `Revise obligation ${previous.receipt_no || previous.id}`,
  );
  await postObligationEntry(tenant, collection, latest.epoch + 1);
}

/**
 * Reverses an obligation collection's posting when the record is archived.
 *
 * Keyed on the archive's own `deletedAt`, so an archive / restore / archive
 * cycle is not mistaken for a replay of the first archive.
 */
export async function tryPostObligationArchiveJournal(
  tenant: string,
  collection: ObligationCollection,
): Promise<void> {
  if (!collection.deletedAt) return;
  const latest = await findLatestObligationPosting(tenant, collection.id);
  if (!latest) return;
  await tryPostArchiveReversalJournal(
    tenant,
    "obligation",
    latest.sourceId,
    collection.deletedAt,
    `Archive obligation ${collection.receipt_no || collection.id}`,
  );
  broadcastLedgerChange(tenant);
}

/**
 * Re-applies an obligation collection's posting when the record is restored.
 *
 * `archivedAt` is the `deletedAt` the record carried while archived, read
 * before the restore cleared it, because it keys the archive reversal.
 */
export async function tryPostObligationRestoreJournal(
  tenant: string,
  collection: ObligationCollection,
  archivedAt: string,
): Promise<void> {
  const latest = await findLatestObligationPosting(tenant, collection.id);
  if (!latest) return;
  await tryPostRestoreJournal(
    tenant,
    "obligation",
    latest.sourceId,
    archivedAt,
    `Restore obligation ${collection.receipt_no || collection.id}`,
  );
  broadcastLedgerChange(tenant);
}

export { findObligationJournalEntry } from "./obligationVoucherLookup.js";
