import { sql } from "drizzle-orm";
import type { Account } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError, PolicyViolationError } from "../../lib/httpErrors.js";
import { isUniqueViolation, uniqueViolationConstraint } from "../../lib/pgErrors.js";
import { accountingAccounts } from "../schema.js";

/**
 * Hierarchy-specific persistence helpers for the chart of accounts.
 *
 * Split out of `accountingAccountsPersist.ts` to keep that module inside the
 * length ceiling, following the `applyExplicitAccountFxFlags` precedent: the
 * bulk upsert leaves untouched columns alone, and the explicitly-sent ones are
 * applied in one follow-up statement.
 */

const hasExplicitParent = (record: Account): boolean => record.parentId !== undefined;

/**
 * Applies the parent links a batch explicitly carries, in one `UPDATE … FROM
 * (VALUES)`.
 *
 * `undefined` means "leave the stored parent alone": a whole-list save re-sends
 * every account it holds, and a partial payload must not silently detach a branch.
 * An explicit `null` moves the account back to the root.
 */
export async function applyExplicitAccountParents(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Account[],
): Promise<void> {
  const explicit = records.filter(hasExplicitParent);
  if (explicit.length === 0) return;
  const rows = explicit.map(
    (record) =>
      sql`(${record.id}::text, ${record.parentId ?? null}::text, ${record.parentId !== null}::boolean)`,
  );
  await tx.execute(sql`
    UPDATE accounting_accounts a
    SET parent_account_id = CASE WHEN v.set_parent THEN v.parent_account_id ELSE a.parent_account_id END
    FROM (VALUES ${sql.join(rows, sql`, `)})
      AS v(id, parent_account_id, set_parent)
    WHERE a.workspace_subdomain = ${subdomain} AND a.id = v.id`);
}

export const ACCOUNT_CODE_UNIQUE_CONSTRAINT = "accounting_accounts_workspace_code_active_uidx";

/**
 * Translates the COA unique-code violation into a 409.
 *
 * `accounting_accounts.code` became unique per active account in 0253; without
 * this mapping a duplicate code surfaced as a 500 from the driver.
 */
export function mapAccountUniqueError(error: unknown): never {
  // Drizzle wraps the driver error, so the constraint name is only reachable through
  // the `cause` chain (`uniqueViolationConstraint` walks it).
  if (
    isUniqueViolation(error) &&
    (uniqueViolationConstraint(error) ?? "").includes(ACCOUNT_CODE_UNIQUE_CONSTRAINT)
  ) {
    throw new ConflictError(
      "An active account with this code already exists",
      "account_code_conflict",
    );
  }
  throw error;
}

/**
 * A restored account may not end up with an archived parent: every reader filters
 * `deleted_at IS NULL`, so the child would drop out of the tree it was restored
 * into. Both sides are restored by the same request when the caller selected the
 * whole branch.
 */
export async function assertRestoredParentsActive(
  tx: TenantTransaction,
  subdomain: string,
  restoredIds: readonly string[],
): Promise<void> {
  const rows = await tx
    .select({
      id: accountingAccounts.id,
      parentAccountId: accountingAccounts.parentAccountId,
      deletedAt: accountingAccounts.deletedAt,
    })
    .from(accountingAccounts)
    .where(sql`${accountingAccounts.workspaceSubdomain} = ${subdomain}`);
  const restored = new Set(restoredIds);
  const archived = new Set(rows.filter((row) => row.deletedAt).map((row) => row.id));
  for (const row of rows) {
    if (!restored.has(row.id) || !row.parentAccountId) continue;
    if (archived.has(row.parentAccountId) && !restored.has(row.parentAccountId)) {
      throw new PolicyViolationError(
        `Cannot restore account ${row.id}: its parent ${row.parentAccountId} is still archived`,
        "account_parent_archived",
        { accountId: row.id, parentId: row.parentAccountId },
      );
    }
  }
}
