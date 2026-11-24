/**
 * Repository loader port for the legacy document store's relational mirror.
 *
 * The document store keeps JSON collections, but REST-migrated collections are
 * backed by relational tables. When a collection is written with
 * `mirrorRelationalReplace`, the store must call that collection's repository
 * helper — and the mapping (`RELATIONAL_REPLACE_MAPPING`) only knows the helper
 * as an app-relative module path (`./repositories/<name>.js`).
 *
 * `be-core` must not know app paths, so the app injects the importer
 * (`apps/backend/src/db/documentStoreRepositoryLoader.ts`), which keeps the
 * specifier resolution relative to the app's `db/` directory. Fail closed: an
 * unconfigured loader throws rather than silently skipping the relational
 * mirror, which would leave the relational tables stale while the document
 * store reported success (docs/monorepo-migration-plan.md U23, P1b-3).
 */
export type DocumentStoreRepositoryLoader = (
  importPath: string,
) => Promise<Record<string, unknown>>;

export class DocumentStoreRepositoryLoaderNotConfiguredError extends Error {
  constructor(importPath: string) {
    super(
      `Document store repository loader is not configured (needed for "${importPath}"). ` +
        "The app composition injects it: importing apps/backend/src/db/documentStoreRepositoryLoader.ts " +
        "registers it via configureDocumentStoreRepositoryLoader(). In tests that use the document store " +
        "directly, import that module (or call configureDocumentStoreRepositoryLoader) first.",
    );
    this.name = "DocumentStoreRepositoryLoaderNotConfiguredError";
  }
}

let loader: DocumentStoreRepositoryLoader | null = null;

/** Register (or clear, with `null`) the importer used to resolve repository modules. */
export function configureDocumentStoreRepositoryLoader(
  next: DocumentStoreRepositoryLoader | null,
): void {
  loader = next;
}

/** Resolve a repository module through the injected importer; fails closed when unset. */
export async function loadDocumentStoreRepository(
  importPath: string,
): Promise<Record<string, unknown>> {
  if (!loader) throw new DocumentStoreRepositoryLoaderNotConfiguredError(importPath);
  return loader(importPath);
}
