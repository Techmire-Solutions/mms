import { queryClientInstance } from "@/lib/queryClient";
import { getCollection } from "@/lib/db";

/**
 * Reads the first array payload matching a TanStack Query key prefix.
 * Prefer exact key matches, then any query under the prefix.
 */
export function readQueryCollection<T>(queryKey: readonly unknown[]): T[] | undefined {
  const exact = queryClientInstance.getQueryData<T[]>(queryKey);
  if (Array.isArray(exact)) return exact;
  const matches = queryClientInstance.getQueriesData<T[]>({ queryKey });
  for (const [, data] of matches) {
    if (Array.isArray(data)) return data;
  }
  return undefined;
}

/**
 * Locates a record by id from Query cache first, then optional localStorage fallback.
 */
export function findCachedCollectionRecord(
  collectionName: string,
  recordId: string,
  queryKey: readonly unknown[],
): Record<string, unknown> | undefined {
  const fromQuery = readQueryCollection<Record<string, unknown>>(queryKey);
  const queryMatch = fromQuery?.find((row) => String(row.id) === String(recordId));
  if (queryMatch) return queryMatch;

  const fromLocal = getCollection<Record<string, unknown>>(collectionName, []);
  return fromLocal.find((row) => String(row.id) === String(recordId));
}
