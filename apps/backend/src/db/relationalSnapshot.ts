import { RELATIONAL_REPLACE_MAPPING } from "./relationalReplaceMapping.js";

/** Credential columns that must never leave the server in a snapshot payload. */
const CREDENTIAL_FIELDS = ["passwordHash"] as const;

// Rows are freshly pulled from each table solely for the backup snapshot and are
// not shared elsewhere, so remove credential columns in place — avoids cloning
// every row (halving the snapshot's peak relational memory on large workspaces).
export function stripCredentials(rows: unknown[]): unknown[] {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    for (const field of CREDENTIAL_FIELDS) {
      delete rec[field];
    }
  }
  return rows;
}

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

    const repoModule = (await import(mapping.importPath)) as Record<string, unknown>;
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
