import type { Contact } from "@mms/shared";

export interface BatchMergePair {
  id: string;
  contacts: [Contact, Contact];
}

export interface BatchMergeResult {
  merged: number;
  /** Failed merges plus pairs skipped because a contact was already merged. */
  failed: number;
  mergedPairIds: string[];
}

/**
 * Merges high-confidence duplicate pairs one by one.
 *
 * A single failure must not discard the pairs that already merged, and a contact
 * that appears in two pairs must only be merged once (its token goes stale after
 * the first write). Callers report `merged`/`failed` and keep the failed pairs
 * visible for review.
 */
export async function runBatchMerge(
  pairs: readonly BatchMergePair[],
  keepIndex: Readonly<Record<string, number>>,
  onMergePair: (keep: Contact, other: Contact, pair: BatchMergePair) => Promise<void>,
  onPairError?: (error: unknown, pair: BatchMergePair) => void,
): Promise<BatchMergeResult> {
  let merged = 0;
  let failed = 0;
  const mergedPairIds: string[] = [];
  const mergedContactIds = new Set<string>();

  for (const pair of pairs) {
    const selectedKeepIndex = keepIndex[pair.id] ?? 0;
    const keep = pair.contacts[selectedKeepIndex];
    const other = pair.contacts[1 - selectedKeepIndex];
    const keepId = String(keep.id);
    const otherId = String(other.id);

    if (mergedContactIds.has(keepId) || mergedContactIds.has(otherId)) {
      failed += 1;
      continue;
    }

    try {
      await onMergePair(keep, other, pair);
      mergedContactIds.add(keepId);
      mergedContactIds.add(otherId);
      merged += 1;
      mergedPairIds.push(pair.id);
    } catch (error) {
      failed += 1;
      onPairError?.(error, pair);
    }
  }

  return { merged, failed, mergedPairIds };
}
