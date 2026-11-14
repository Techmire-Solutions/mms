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
import { withTenant } from "../../db/tenant-context.js";
import { auditCollectionsDeleted, auditCollectionsRestored } from "./obligationAuditTrail.js";
import { logger } from "../../lib/logger.js";

/**
 * How a posting failure is treated.
 *
 * - `strict` — the lifecycle transitions (archive / restore): any failure aborts both the posting
 *   and the row write. An archived receipt whose reversal never posted is a silent bookkeeping gap.
 * - `policy` — create / save: a **domain rejection** (4xx: closed fiscal year, archived account,
 *   unbalanced entry) aborts the write, because a receipt the ledger refuses must not be recorded
 *   as if it had been. An infrastructure failure (5xx) is logged and the write stands: a temporary
 *   ledger outage must not block recording money that was actually received, and the audit row
 *   added alongside the write makes the gap attributable.
 */
type PostingFailureMode = "strict" | "policy";

function isDomainRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500;
}

async function runLedgerPosting(
  action: string,
  tenant: string,
  collectionId: string,
  posting: () => Promise<void>,
  mode: PostingFailureMode,
): Promise<void> {
  try {
    await posting();
  } catch (error: unknown) {
    if (mode === "strict" || isDomainRejection(error)) throw error;
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
  await runLedgerPosting(
    "create",
    tenant,
    collection.id,
    () => tryPostObligationJournal(tenant, collection),
    "policy",
  );
}

/** Reverses a stale entry and posts the corrected one after an edit. */
export async function postSavedCollection(
  tenant: string,
  collection: ObligationCollection,
  previous: ObligationCollection | null,
): Promise<void> {
  await runLedgerPosting(
    "save",
    tenant,
    collection.id,
    () => syncObligationJournal(tenant, collection, previous),
    "policy",
  );
}

/** Reverses the postings of every collection that was just archived. */
export async function postArchivedCollections(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
  options: { strict?: boolean } = {},
): Promise<void> {
  const archived = await loadCollectionsById(repo, tenant, ids);
  for (const collection of archived.values()) {
    if (!collection.deletedAt) continue;
    await runLedgerPosting(
      "archive",
      tenant,
      collection.id,
      () => tryPostObligationArchiveJournal(tenant, collection),
      options.strict ? "strict" : "policy",
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
  options: { strict?: boolean } = {},
): Promise<void> {
  for (const { collection, archivedAt } of restored) {
    await runLedgerPosting(
      "restore",
      tenant,
      collection.id,
      () => tryPostObligationRestoreJournal(tenant, collection, archivedAt),
      options.strict ? "strict" : "policy",
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

/**
 * Archives collections and reverses their postings in **one** transaction.
 *
 * The two steps used to be separate transactions with the posting failure swallowed to a log
 * line: the row left every active view while the journal entry that says the money was received
 * stayed on the books, and nothing recorded the gap. `withTenant` joins the ambient transaction,
 * so the nested write and the posting below commit or roll back together.
 */
export async function archiveCollectionsWithLedger<T>(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
  run: () => Promise<T>,
  audit?: { deletedBy: string; reason?: string },
): Promise<T> {
  return withTenant(tenant, async () => {
    const result = await run();
    // Same transaction as the archive: the DELETE row (with its reason) and the
    // `entity.soft_deleted` outbox event cannot be lost while the row disappears from every view.
    if (audit) {
      const archived = await loadCollectionsById(repo, tenant, ids);
      await auditCollectionsDeleted(
        tenant,
        [...archived.values()].filter((row) => row.deletedAt),
        audit,
      );
    }
    await postArchivedCollections(repo, tenant, ids, { strict: true });
    return result;
  });
}

/** Restores collections and re-applies their postings in one transaction (see above). */
export async function restoreCollectionsWithLedger<T>(
  repo: ObligationsRepository,
  tenant: string,
  ids: readonly string[],
  run: (archived: { collection: ObligationCollection; archivedAt: string }[]) => Promise<T>,
  audit?: { restoredBy: string | null },
): Promise<T> {
  return withTenant(tenant, async () => {
    const archived = await snapshotArchivedCollections(repo, tenant, ids);
    const result = await run(archived);
    if (audit) await auditCollectionsRestored(tenant, archived, audit.restoredBy);
    await postRestoredCollections(tenant, archived, { strict: true });
    return result;
  });
}
