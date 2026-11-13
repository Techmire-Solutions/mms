import { and, eq, inArray } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import { accountingEntries } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Optimistic concurrency for journal saves.
 *
 * A client echoes the `updatedAt` of the row it edited. Comparing it against the
 * stored row under `FOR UPDATE` turns a lost update into a 409 instead of letting
 * the last writer silently overwrite a draft another user changed. The rows are
 * locked first so a writer that commits while this transaction waits is seen
 * rather than overwritten. A record without a token is accepted — every shipped
 * client echoes one, and the audit doc records the residual (conditional-CAS
 * decision).
 */
export async function assertEntriesFresh(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly JournalEntry[],
): Promise<void> {
  const tokens = records.filter(
    (record) => typeof record.updatedAt === "string" && record.updatedAt.trim() !== "",
  );
  if (tokens.length === 0) return;
  const ids = [...new Set(tokens.map((record) => record.id.trim()).filter(Boolean))];
  if (ids.length === 0) return;

  const rows = await tx
    .select({ id: accountingEntries.id, updatedAt: accountingEntries.updatedAt })
    .from(accountingEntries)
    .where(
      and(eq(accountingEntries.workspaceSubdomain, subdomain), inArray(accountingEntries.id, ids)),
    )
    .for("update");
  const stored = new Map(rows.map((row) => [row.id, row.updatedAt]));
  const stale = tokens
    .map((record) => {
      const current = stored.get(record.id);
      const expected = new Date(record.updatedAt as string);
      if (!current || Number.isNaN(expected.getTime())) return null;
      return current.getTime() === expected.getTime() ? null : record.id;
    })
    .filter((id): id is string => Boolean(id));
  if (stale.length > 0) {
    throw new ConflictError(
      `Journal entry changed since it was read (${stale.join(", ")}) — reload and retry`,
      "stale_write",
      { ids: stale },
    );
  }
}

/**
 * Copies the stored `updated_at` back onto the written records.
 *
 * The value must come from the row, not from an app-side `new Date()`: a
 * `BEFORE UPDATE` trigger (`update_accounting_entries_updated_at`, 0031) stamps
 * `updated_at` on every update, so the trigger's clock — not the caller's — is what
 * the next save has to echo. Without this the client would resume from its own
 * timestamp and the very next save would be a spurious 409.
 */
export async function readStoredUpdatedTokens(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly JournalEntry[],
): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();
  if (records.length === 0) return tokens;
  const ids = [...new Set(records.map((record) => record.id.trim()).filter(Boolean))];
  if (ids.length === 0) return tokens;
  const rows = await tx
    .select({ id: accountingEntries.id, updatedAt: accountingEntries.updatedAt })
    .from(accountingEntries)
    .where(
      and(eq(accountingEntries.workspaceSubdomain, subdomain), inArray(accountingEntries.id, ids)),
    );
  for (const row of rows) tokens.set(row.id, row.updatedAt.toISOString());
  return tokens;
}

/**
 * Applies tokens to the records a caller will hand back. `bulkSaveEntries` works on
 * de-duplicated copies, so both the internal batch and the caller's array need the
 * stored value — otherwise the response carries a token the next save rejects.
 */
export function applyUpdatedTokens(
  tokens: ReadonlyMap<string, string>,
  records: readonly JournalEntry[],
): void {
  for (const record of records) {
    const token = tokens.get(record.id);
    if (token) record.updatedAt = token;
  }
}
