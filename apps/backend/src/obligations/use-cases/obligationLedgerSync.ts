/**
 * @file obligationLedgerSync.ts
 * @description Keeps the general ledger aligned with obligation collection writes.
 */

import type { ObligationCollection } from "@mms/shared";
import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import {
  syncObligationJournal,
  tryPostObligationArchiveJournal,
  tryPostObligationJournal,
  tryPostObligationRestoreJournal,
} from "../../accounting/ledgerPosting/obligationPostingService.js";
import { logger } from "../../lib/logger.js";

/**
 * Runs a ledger posting without failing the collection write it follows.
 *
 * Posting happens after the record is saved, so a posting failure must not
 * roll back or reject a save the user already completed. It is logged rather
 * than swallowed, because an unposted receipt is a bookkeeping gap somebody
 * has to find.
 */
async function runLedgerPosting(
  action: string,
  tenant: string,
  collectionId: string,
  posting: () => Promise<void>,
): Promise<void> {
  try {
    await posting();
  } catch (error: unknown) {
    logger.error({ err: error, tenant, collectionId, action }, "Obligation ledger posting failed");
  }
}

/** Loads collections by id, including archived ones, keyed for lookup. */
export async function loadCollectionsById(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
): Promise<Map<string, ObligationCollection>> {
  if (ids.length === 0) return new Map();
  const records = await repo.findObligationCollectionsByIds(tenant, [...ids], {
    includeDeleted: true,
  });
  return new Map(records.map((record) => [record.id, record]));
}

/** Posts the opening entry for a newly created collection. */
export async function postCreatedCollection(
  tenant: string,
  collection: ObligationCollection,
): Promise<void> {
  await runLedgerPosting("create", tenant, collection.id, () =>
    tryPostObligationJournal(tenant, collection),
  );
}

/** Reverses a stale entry and posts the corrected one after an edit. */
export async function postSavedCollection(
  tenant: string,
  collection: ObligationCollection,
  previous: ObligationCollection | null,
): Promise<void> {
  await runLedgerPosting("save", tenant, collection.id, () =>
    syncObligationJournal(tenant, collection, previous),
  );
}

/** Reverses the postings of every collection that was just archived. */
export async function postArchivedCollections(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
): Promise<void> {
  const archived = await loadCollectionsById(repo, tenant, ids);
  for (const collection of archived.values()) {
    if (!collection.deletedAt) continue;
    await runLedgerPosting("archive", tenant, collection.id, () =>
      tryPostObligationArchiveJournal(tenant, collection),
    );
  }
}

/**
 * Re-applies the postings of every collection that was just restored.
 *
 * `archivedAt` is captured before the restore, because the restore clears
 * `deletedAt` and that value is the key the archive reversal was filed under.
 */
export async function postRestoredCollections(
  tenant: string,
  restored: readonly { collection: ObligationCollection; archivedAt: string }[],
): Promise<void> {
  for (const { collection, archivedAt } of restored) {
    await runLedgerPosting("restore", tenant, collection.id, () =>
      tryPostObligationRestoreJournal(tenant, collection, archivedAt),
    );
  }
}

/** Snapshots the archive timestamps of collections about to be restored. */
export async function snapshotArchivedCollections(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
): Promise<{ collection: ObligationCollection; archivedAt: string }[]> {
  const records = await loadCollectionsById(repo, tenant, ids);
  const snapshot: { collection: ObligationCollection; archivedAt: string }[] = [];
  for (const collection of records.values()) {
    if (collection.deletedAt) snapshot.push({ collection, archivedAt: collection.deletedAt });
  }
  return snapshot;
}
