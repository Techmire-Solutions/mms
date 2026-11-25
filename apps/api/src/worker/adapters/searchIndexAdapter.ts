import { logger } from "../../lib/logger.js";

/**
 * Interface contract for the search index adapter.
 * Implemented as a no-op stub until a Meilisearch client is provisioned.
 * Wire a concrete implementation by replacing `defaultSearchAdapter` at the
 * composition root (worker/index.ts or dependency injection).
 */
export interface SearchIndexAdapter {
  /**
   * Remove a document from the search index for the given entity.
   * Called when `entity.soft_deleted` is processed.
   */
  deleteDocument(entityType: string, entityId: string): Promise<void>;

  /**
   * Add or replace a document in the search index.
   * Called when `entity.restored` is processed.
   */
  indexDocument(entityType: string, entityId: string, doc: Record<string, unknown>): Promise<void>;
}

/**
 * No-op search adapter — logs the intended operation so the stub can be
 * replaced with a real Meilisearch client when provisioned.
 *
 * Replace: `import { MeiliSearch } from 'meilisearch'` and wire a real adapter
 * that calls `meiliSearch.index(entityType).deleteDocument(entityId)` etc.
 */
export const defaultSearchAdapter: SearchIndexAdapter = {
  async deleteDocument(entityType, entityId) {
    logger.info(
      { entityType, entityId },
      "[SearchAdapter] STUB: would delete document from search index",
    );
  },
  async indexDocument(entityType, entityId, doc) {
    logger.info(
      { entityType, entityId, docKeys: Object.keys(doc) },
      "[SearchAdapter] STUB: would index document in search index",
    );
  },
};
