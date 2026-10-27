import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Explicit "this document-store work is platform/global" scope.
 *
 * The document store (`collections` / `objects`) is tenant-scoped by KEY PREFIX
 * rather than by a tenant column — `documentStoreKeys.ts` returns the bare name
 * when no tenant is bound. Before this scope existed, every store function
 * passed `{ allowGlobal: !tenant }` into `withTenant`, which meant a request
 * path that lost its AsyncLocalStorage context silently read and wrote
 * UNPREFIXED (i.e. cross-tenant) rows.
 *
 * Now the store passes `{ allowGlobal: !tenant && inGlobalDocumentStoreScope() }`,
 * so that fallback only happens inside an explicit global scope:
 *
 * - boot-time seeding and the `db/migrations/*` data-migration runner (dbInit.ts);
 * - whole-database restore / platform maintenance that legitimately has no tenant.
 *
 * A tenant request that loses its context now fails loudly instead.
 */
const globalScopeStorage = new AsyncLocalStorage<boolean>();

/** Runs `fn` with the document store's explicit global fallback enabled. */
export function runWithGlobalDocumentStore<T>(fn: () => Promise<T>): Promise<T> {
  return globalScopeStorage.run(true, fn);
}

/** True only inside `runWithGlobalDocumentStore`. */
export function inGlobalDocumentStoreScope(): boolean {
  return globalScopeStorage.getStore() === true;
}
