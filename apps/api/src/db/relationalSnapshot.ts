import "./documentStoreRepositoryLoader.js";
import { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMapping.js";
import { loadDocumentStoreRepository } from "@mms/be-core/db-sync/documentStoreRepositoryLoader";
import { stripCredentials } from "@mms/be-core/db-sync/stripCredentials";

export { stripCredentials };

/**
 * Reads every REST-migrated collection straight from its relational table.
 *
 * The legacy `collections` document store is only written by the deprecated
 * `/api/db/collections/:name` path, so it is stale for REST-migrated modules —
 * backups must read the tables that own the data.
 */
export async function loadRelationalSnapshotCollections(
  workspaceSubdomain: string,
): Promise<Record<string, unknown[]>> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const collections: Record<string, unknown[]> = {};

  for (const [logicalKey, mapping] of Object.entries(RELATIONAL_REPLACE_MAPPING)) {
    if (!mapping.snapshotFnName) continue;

    const repoModule = await loadDocumentStoreRepository(mapping.importPath);
    const listRows = repoModule[mapping.snapshotFnName];
    if (typeof listRows !== "function") {
      throw new Error(
        `Backup snapshot helper "${mapping.snapshotFnName}" missing for collection "${logicalKey}"`,
      );
    }

    const rows = await (listRows as (subdomain: string) => Promise<unknown[]>)(subdomain);
    collections[logicalKey] = stripCredentials(Array.isArray(rows) ? rows : []);
  }

  return collections;
}
