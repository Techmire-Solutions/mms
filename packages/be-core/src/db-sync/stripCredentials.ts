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
