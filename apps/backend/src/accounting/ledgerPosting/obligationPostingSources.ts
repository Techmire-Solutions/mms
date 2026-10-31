/**
 * @file obligationPostingSources.ts
 * @description Ledger source-key arithmetic for obligation collection postings.
 */

import crypto from "node:crypto";
import { findEntryIdBySource } from "../../db/repositories/accountingRepository.js";

/**
 * Highest epoch probed before giving up.
 *
 * Each correction to a receipt consumes one epoch, so the ceiling only has to
 * exceed any plausible number of corrections to a single receipt.
 */
const MAX_POSTING_EPOCHS = 100;

/**
 * Ledger `source_id` for one posting generation of an obligation collection.
 *
 * Corrections cannot reuse a key: entries are unique per
 * `(source_type, source_id)`, so a corrected receipt posted under the original
 * key would be silently dropped as a replay. The epoch counts corrections, and
 * is hashed with the collection id because `source_id` is `varchar(64)`.
 *
 * The epoch is deliberately a counter rather than a hash of the receipt's
 * contents. A content key breaks when a receipt is edited and then changed
 * back: the restored contents would collide with the already-reversed original
 * and the receipt would sit on the books reversed.
 */
export function obligationEntrySourceId(collectionId: string, epoch: number): string {
  return `oc-${crypto.hash("sha256", `${collectionId}|${epoch}`, "hex").slice(0, 40)}`;
}

export interface ActiveObligationPosting {
  epoch: number;
  sourceId: string;
}

/**
 * Finds the newest posting generation on the books for a collection.
 *
 * Epochs are allocated densely from zero, so the first gap ends the search.
 * Returns `null` when the collection has never posted.
 */
export async function findLatestObligationPosting(
  tenant: string,
  collectionId: string,
): Promise<ActiveObligationPosting | null> {
  let latest: ActiveObligationPosting | null = null;
  for (let epoch = 0; epoch < MAX_POSTING_EPOCHS; epoch += 1) {
    const sourceId = obligationEntrySourceId(collectionId, epoch);
    const entryId = await findEntryIdBySource(tenant, "obligation", sourceId);
    if (!entryId) break;
    latest = { epoch, sourceId };
  }
  return latest;
}
