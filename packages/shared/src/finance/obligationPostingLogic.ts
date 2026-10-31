/**
 * @file obligationPostingLogic.ts
 * @description Pure ledger line builder for Obligation Collections based on Wakala distributions.
 */

import { isJournalEntryBalanced, moneyToCents } from "./accountingLedgerInvariants.js";
import type { JournalLine } from "./accountingModuleManifest.js";

export interface ObligationDistributionRule {
  id: string;
  name: string;
  percentage: number;
  type: "Income" | "Liability";
  accountId?: string | null;
}

/**
 * Posting-relevant fields of an obligation collection.
 *
 * A change to any of these invalidates an existing journal entry, so they are
 * exactly the fields {@link buildObligationRevisionKey} hashes.
 */
export interface ObligationPostingRevisionSource {
  amount: number;
  payment_mode: string;
  received_date?: string;
  obligation_type_id: string;
  mujtahid_representative_id: string;
}

/**
 * Stable key identifying one posted revision of an obligation collection.
 *
 * Editing a collection must reverse the stale journal entry and post a fresh
 * one. Entries are filed under `(source_type, source_id)` and that key is
 * unique, so every revision needs its own `source_id`. Distribution rules are
 * deliberately excluded: re-splitting past receipts when a wakala percentage
 * changes would rewrite closed periods.
 */
export function buildObligationRevisionKey(source: ObligationPostingRevisionSource): string {
  return [
    moneyToCents(source.amount),
    (source.payment_mode || "").trim().toLowerCase(),
    source.received_date || "",
    source.obligation_type_id,
    source.mujtahid_representative_id,
  ].join("|");
}

export interface ObligationPostingInput {
  collectionId: string;
  receiptNo: string;
  amount: number;
  date: string;
  paymentMode: string;
  description: string;
  distributions: ObligationDistributionRule[];
  cashAccountId?: string | null;
  bankAccountId?: string | null;
  defaultIncomeAccountId?: string | null;
  defaultLiabilityAccountId?: string | null;
  /** Ids of the workspace chart of accounts. Lines referencing anything else are rejected. */
  knownAccountIds: ReadonlySet<string>;
}

/** Resolves the receiving asset account (Cash vs Bank) based on payment mode. */
export function resolveObligationAssetAccount(
  paymentMode: string,
  accounts: { cashAccountId?: string | null; bankAccountId?: string | null },
): string | null {
  const mode = (paymentMode || "").trim().toLowerCase();
  if (mode === "cash") {
    return accounts.cashAccountId || accounts.bankAccountId || null;
  }
  return accounts.bankAccountId || accounts.cashAccountId || null;
}

/** Builds balanced Dr Cash/Bank / Cr Distributions (Income/Liability) journal lines. */
export function buildObligationPostingLines(input: ObligationPostingInput): JournalLine[] | null {
  const {
    collectionId,
    amount,
    paymentMode,
    description,
    distributions,
    cashAccountId,
    bankAccountId,
    defaultIncomeAccountId,
    defaultLiabilityAccountId,
    knownAccountIds,
  } = input;

  if (amount <= 0 || !Number.isFinite(amount)) return null;

  const assetAccountId = resolveObligationAssetAccount(paymentMode, {
    cashAccountId,
    bankAccountId,
  });
  if (!assetAccountId || !knownAccountIds.has(assetAccountId)) return null;

  const totalCents = moneyToCents(amount);
  if (totalCents <= 0) return null;

  const lines: JournalLine[] = [];

  // Debit: Receiving Cash or Bank account
  lines.push({
    id: `oc-dr-${collectionId}`,
    account_id: assetAccountId,
    debit: amount,
    credit: 0,
    description: `Received via ${paymentMode || "Cash"}`,
  });

  // If no distributions configured, fallback to 100% to default income account if available
  if (distributions.length === 0) {
    if (!defaultIncomeAccountId || !knownAccountIds.has(defaultIncomeAccountId)) return null;
    lines.push({
      id: `oc-cr-${collectionId}-default`,
      account_id: defaultIncomeAccountId,
      debit: 0,
      credit: amount,
      description: description || "Obligation Collection",
    });
    return isJournalEntryBalanced(lines) ? lines : null;
  }

  // Calculate proportional split in cents to avoid floating-point drift
  const totalPercentage = distributions.reduce((sum, d) => sum + (Number(d.percentage) || 0), 0);
  const effectiveTotalPct = totalPercentage > 0 ? totalPercentage : 100;

  const distCentsList: {
    rule: ObligationDistributionRule;
    cents: number;
    targetAccountId: string;
  }[] = [];

  for (const dist of distributions) {
    const targetAccountId =
      dist.accountId ||
      (dist.type === "Income" ? defaultIncomeAccountId : defaultLiabilityAccountId);

    // An unmapped distribution, or one pointing at an account that no longer
    // exists in the chart, must not be silently redirected elsewhere.
    if (!targetAccountId || !knownAccountIds.has(targetAccountId)) return null;

    const pct = Math.max(0, Number(dist.percentage) || 0);
    const lineCents = Math.round((totalCents * pct) / effectiveTotalPct);
    distCentsList.push({ rule: dist, cents: lineCents, targetAccountId });
  }

  // Reconcile penny rounding discrepancy onto the largest line
  const allocatedCents = distCentsList.reduce((sum, d) => sum + d.cents, 0);
  const diffCents = totalCents - allocatedCents;
  if (diffCents !== 0 && distCentsList.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < distCentsList.length; i++) {
      if (distCentsList[i].cents > distCentsList[maxIdx].cents) {
        maxIdx = i;
      }
    }
    distCentsList[maxIdx].cents += diffCents;
  }

  for (let i = 0; i < distCentsList.length; i++) {
    const item = distCentsList[i];
    const lineAmount = item.cents / 100;
    if (lineAmount <= 0) continue;

    lines.push({
      id: `oc-cr-${collectionId}-${item.rule.id || i}`,
      account_id: item.targetAccountId,
      debit: 0,
      credit: lineAmount,
      description: `${item.rule.name} (${item.rule.percentage}%)`,
    });
  }

  return isJournalEntryBalanced(lines) ? lines : null;
}
