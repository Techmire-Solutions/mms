/**
 * @file obligationVoucherLookup.ts
 * @description Looks up or generates on-demand general ledger vouchers for obligation receipts.
 */

import type { Account, JournalEntry } from "@mms/shared";
import { findEntryById, findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { listAccountsByWorkspace } from "../../db/repositories/accountingAccountsRepository.js";
import { obligationsRepository } from "../../obligations/repository/obligationsRepositoryAdapter.js";
import { findLatestObligationPosting } from "./obligationPostingSources.js";
import { tryPostObligationJournal } from "./obligationPostingService.js";

/**
 * Loads the active journal entry and chart of accounts for an obligation collection.
 * If not yet posted, posts it immediately so the voucher is available on demand.
 */
export async function findObligationJournalEntry(
  tenant: string,
  collectionId: string,
): Promise<{ entry: JournalEntry; accounts: Account[] } | null> {
  let latest = await findLatestObligationPosting(tenant, collectionId);
  let entryId = latest ? await findEntryIdBySource(tenant, "obligation", latest.sourceId) : null;

  if (!entryId) {
    const collection = await obligationsRepository.findObligationCollectionById(
      tenant,
      collectionId,
    );
    if (collection && !collection.deletedAt && collection.amount > 0) {
      await tryPostObligationJournal(tenant, collection);
      latest = await findLatestObligationPosting(tenant, collectionId);
      if (latest) entryId = await findEntryIdBySource(tenant, "obligation", latest.sourceId);
    }
  }

  if (!entryId) return null;
  const [entry, accounts] = await Promise.all([
    findEntryById(tenant, entryId),
    listAccountsByWorkspace(tenant),
  ]);
  if (!entry) return null;
  return { entry, accounts };
}
