import { and, eq, inArray, or } from "drizzle-orm";
import {
  checkAccountParent,
  dedupeTrimmedIds,
  describeAccountHierarchyViolation,
  type Account,
} from "@mms/shared";
import {
  accountingAccounts,
  accountingJournalLines,
  accountingModulePreferences,
  accountingPostingRules,
} from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError, PolicyViolationError } from "../../lib/httpErrors.js";

/**
 * Chart-of-accounts write guards.
 *
 * They live in their own module because they run inside the caller's transaction
 * (the shared `withTenant` joins the ambient one) and every writer — single save,
 * bulk list save, restore — has to go through the same rules. The database backs
 * them up in 0253; these versions exist to produce a domain error instead of a
 * raw `check_violation`.
 */

/** The COA projection the hierarchy walk needs. */
const hierarchyColumns = {
  id: accountingAccounts.id,
  parentAccountId: accountingAccounts.parentAccountId,
  deletedAt: accountingAccounts.deletedAt,
};

/**
 * Rejects a parent link that would create a self-parent, a cycle, a chain deeper
 * than the maximum, a missing parent or an archived parent. Loads the COA under
 * the caller's transaction so the check sees the same snapshot as the write, and
 * the query itself serializes concurrent hierarchy writes for the workspace.
 */
export async function assertAccountHierarchyAllowed(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Account[],
): Promise<void> {
  const proposed = records.filter((record) => record.parentId !== undefined && record.parentId);
  if (proposed.length === 0) return;

  const rows = await tx
    .select(hierarchyColumns)
    .from(accountingAccounts)
    .where(eq(accountingAccounts.workspaceSubdomain, subdomain));
  const nodes = rows.map((row) => ({
    id: row.id,
    parentId: row.parentAccountId,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  }));

  // An account that already carries journal lines would become a summary account the
  // moment it gains a child, and the line guard would then reject every future line on
  // it. Refuse the reparent (the 0254 trigger enforces the same direction).
  const parentIds = dedupeTrimmedIds(
    proposed.map((record) => record.parentId).filter((id): id is string => Boolean(id)),
  );
  if (parentIds.length > 0) {
    const usedParents = await tx
      .select({ accountId: accountingJournalLines.accountId })
      .from(accountingJournalLines)
      .where(
        and(
          eq(accountingJournalLines.workspaceSubdomain, subdomain),
          inArray(accountingJournalLines.accountId, parentIds),
        ),
      )
      .groupBy(accountingJournalLines.accountId);
    if (usedParents.length > 0) {
      const parentId = usedParents[0]!.accountId;
      throw new PolicyViolationError(
        `Account ${parentId} already carries journal lines and cannot become a parent`,
        "account_parent_has_lines",
        { parentId },
      );
    }
  }

  for (const record of proposed) {
    const check = checkAccountParent(nodes, record.id, record.parentId);
    if (check.ok) continue;
    throw new PolicyViolationError(
      describeAccountHierarchyViolation(check.violation ?? "unknown_parent", {
        accountId: record.id,
        parentId: record.parentId,
        chain: check.chain,
      }),
      "account_hierarchy_invalid",
      { accountId: record.id, parentId: record.parentId ?? null, violation: check.violation },
    );
  }
}

/**
 * Refuses to archive an account the posting rules or the closing preference point
 * at: soft delete bypasses every FK, so the configuration would keep a dangling id
 * and the next posting would fail. The 0253 trigger enforces the same rule for
 * writers that bypass this layer.
 */
export async function assertAccountsNotConfigured(
  tx: TenantTransaction,
  subdomain: string,
  accountIds: readonly string[],
): Promise<void> {
  const ids = dedupeTrimmedIds([...accountIds]);
  if (ids.length === 0) return;

  const rules = await tx
    .select({ id: accountingPostingRules.workspaceSubdomain })
    .from(accountingPostingRules)
    .where(
      and(
        eq(accountingPostingRules.workspaceSubdomain, subdomain),
        or(
          inArray(accountingPostingRules.arAccountId, ids),
          inArray(accountingPostingRules.cashAccountId, ids),
          inArray(accountingPostingRules.bankAccountId, ids),
          inArray(accountingPostingRules.incomeAccountId, ids),
          inArray(accountingPostingRules.discountAccountId, ids),
          inArray(accountingPostingRules.fxRealizedAccountId, ids),
          inArray(accountingPostingRules.fxUnrealizedAccountId, ids),
          inArray(accountingPostingRules.fxRoundingAccountId, ids),
          inArray(accountingPostingRules.ctaAccountId, ids),
        ),
      ),
    )
    .limit(1);
  if (rules.length > 0) {
    throw new PolicyViolationError(
      "Cannot archive an account the posting rules point at — repoint the rules first",
      "account_configured",
      { accountIds: ids },
    );
  }

  const [preferences] = await tx
    .select({ preferences: accountingModulePreferences.preferences })
    .from(accountingModulePreferences)
    .where(eq(accountingModulePreferences.workspaceSubdomain, subdomain))
    .limit(1);
  const retained = (preferences?.preferences as { retainedEarningsAccountId?: unknown })
    ?.retainedEarningsAccountId;
  if (typeof retained === "string" && ids.includes(retained)) {
    throw new PolicyViolationError(
      "Cannot archive the retained-earnings account the fiscal close posts to",
      "account_configured",
      { accountIds: [retained] },
    );
  }
}

/** The columns a configuration edit can change; `updatedAt` alone is not content. */
const configurableColumns = {
  id: accountingAccounts.id,
  updatedAt: accountingAccounts.updatedAt,
  code: accountingAccounts.code,
  name: accountingAccounts.name,
  type: accountingAccounts.type,
  subtype: accountingAccounts.subtype,
  description: accountingAccounts.description,
  isActive: accountingAccounts.isActive,
  parentAccountId: accountingAccounts.parentAccountId,
  isMonetary: accountingAccounts.isMonetary,
  accountCurrency: accountingAccounts.accountCurrency,
  allowRevaluation: accountingAccounts.allowRevaluation,
};

type ConfigurableRow = {
  [K in keyof typeof configurableColumns]: unknown;
};

const storedConfigurable = (row: ConfigurableRow) => ({
  code: row.code,
  name: row.name,
  type: row.type,
  subtype: row.subtype,
  description: row.description,
  isActive: row.isActive,
  parentAccountId: row.parentAccountId,
  isMonetary: row.isMonetary,
  accountCurrency: row.accountCurrency,
  allowRevaluation: row.allowRevaluation,
});

/**
 * True when the payload would actually change the stored account.
 *
 * A whole-list settings save re-sends every account, so comparing `updatedAt` for
 * untouched rows would make any concurrent edit elsewhere block a save that changes
 * nothing on that row. OCC is about the rows being written.
 */
function accountContentChanged(
  record: Account,
  stored: ReturnType<typeof storedConfigurable>,
): boolean {
  const incoming = {
    code: record.code,
    name: record.name,
    type: record.type,
    subtype: record.subtype ?? "",
    description: record.description ?? "",
    isActive: record.isActive ?? true,
    // `undefined` means "leave the stored parent alone" (see
    // `applyExplicitAccountParents`), so it cannot be a difference.
    parentAccountId: record.parentId === undefined ? stored.parentAccountId : record.parentId,
    isMonetary: record.isMonetary === undefined ? stored.isMonetary : record.isMonetary,
    accountCurrency:
      record.accountCurrency === undefined ? stored.accountCurrency : record.accountCurrency,
    allowRevaluation:
      record.allowRevaluation === undefined ? stored.allowRevaluation : record.allowRevaluation,
  };
  return (Object.keys(incoming) as Array<keyof typeof incoming>).some(
    (key) => incoming[key] !== stored[key],
  );
}

/**
 * Optimistic concurrency for account configuration writes.
 *
 * A client that read an account and sends its `updatedAt` back may not overwrite a
 * newer stored row: the mismatch is a 409 with the offending ids, so the UI can
 * reload instead of silently losing the other edit. The rows are locked `FOR UPDATE`
 * before the comparison, so a writer that commits while this transaction waits is
 * seen rather than overwritten. A record without a token is accepted (the shipped
 * clients always echo one; see the audit doc).
 */
export async function assertAccountsFresh(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Account[],
): Promise<void> {
  const tokens = records.filter(
    (record) => typeof record.updatedAt === "string" && record.updatedAt.trim() !== "",
  );
  if (tokens.length === 0) return;

  const ids = dedupeTrimmedIds(tokens.map((record) => record.id));
  if (ids.length === 0) return;

  const rows = await tx
    .select(configurableColumns)
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.workspaceSubdomain, subdomain),
        inArray(accountingAccounts.id, ids),
      ),
    )
    .for("update");
  const stored = new Map(rows.map((row) => [row.id, row]));

  const stale = tokens
    .map((record) => {
      const current = stored.get(record.id);
      if (!current) return null;
      if (!accountContentChanged(record, storedConfigurable(current))) return null;
      const expected = new Date(record.updatedAt as string);
      if (Number.isNaN(expected.getTime())) return null;
      // Both sides go through JS Date (millisecond precision) — the same
      // `date_trunc('milliseconds', …)` contract the faculty CAS uses.
      return current.updatedAt.getTime() === expected.getTime() ? null : record.id;
    })
    .filter((id): id is string => Boolean(id));

  if (stale.length > 0) {
    throw new ConflictError(
      `Account configuration changed since it was read (${stale.join(", ")}) — reload and retry`,
      "stale_write",
      { ids: stale },
    );
  }
}
