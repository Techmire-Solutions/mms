/**
 * Paging window for the tests/results collections.
 *
 * Without explicit paging the collection returns a bounded snapshot (500); a paged request is capped
 * at 100 so `page * limit` can never become an unbounded offset scan.
 */
const COLLECTION_SNAPSHOT_LIMIT = 500;

export function pagingWindow(paging?: { page?: number; limit?: number }): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(
    Math.max(paging?.limit ?? COLLECTION_SNAPSHOT_LIMIT, 1),
    paging?.limit === undefined ? COLLECTION_SNAPSHOT_LIMIT : 100,
  );
  const page = Math.max(paging?.page ?? 1, 1);
  return { limit, offset: (page - 1) * limit };
}
