/**
 * Chart-of-accounts hierarchy rules.
 *
 * The COA model was flat: hierarchy was only implied by free-text `code`
 * prefixes, so nothing stopped a code from sorting under a parent it does not
 * belong to, and no relationship could be stored at all. A parent link is now
 * persisted (`accounting_accounts.parent_account_id`), and the rules that make
 * it safe live here so the backend validator, the database trigger and any
 * future tree UI agree on one definition:
 *
 *   • an account cannot be its own parent;
 *   • the parent must exist and be active (a trashed parent would orphan the
 *     branch from every list, which filters `deleted_at IS NULL`);
 *   • the chain must not loop (a cycle makes any recursive rollup hang);
 *   • the chain is bounded by {@link ACCOUNT_HIERARCHY_MAX_DEPTH}, which the
 *     0253 trigger also enforces.
 *
 * Pure: no DB, no HTTP. The backend maps {@link AccountHierarchyViolation} to a
 * 422; the database raises `check_violation` for writers that bypass the app.
 */

/** Deepest allowed ancestor chain (root = depth 0). Matches the 0253 trigger. */
export const ACCOUNT_HIERARCHY_MAX_DEPTH = 8;

/** The minimum shape the rules need — structural, so no import cycle with the DTO. */
export interface AccountHierarchyNode {
  id: string;
  parentId?: string | null;
  /** ISO timestamp; a parent in the trash cannot host an active child. */
  deletedAt?: string | null;
}

export type AccountHierarchyViolation =
  "self_parent" | "unknown_parent" | "archived_parent" | "cycle" | "too_deep";

export interface AccountHierarchyCheck {
  ok: boolean;
  violation?: AccountHierarchyViolation;
  /** Ancestors of the proposed parent, nearest first, up to the root. */
  chain?: string[];
}

/**
 * Validates `parentId` for `accountId` against the current COA.
 *
 * `nodes` is the COA before the write. The stored row for `accountId` is ignored
 * on purpose: the check describes the proposed state, so a reparent is judged by
 * the incoming parent rather than the one already stored.
 */
export function checkAccountParent(
  nodes: readonly AccountHierarchyNode[],
  accountId: string,
  parentId: string | null | undefined,
): AccountHierarchyCheck {
  if (!parentId) return { ok: true };
  if (parentId === accountId) return { ok: false, violation: "self_parent" };

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parent = byId.get(parentId);
  if (!parent) return { ok: false, violation: "unknown_parent" };
  if (parent.deletedAt) return { ok: false, violation: "archived_parent" };

  const chain: string[] = [];
  const seen = new Set<string>([accountId]);
  let cursor: string | null | undefined = parentId;
  while (cursor) {
    // Reaching `accountId` is the cycle being introduced; any other repeat means
    // the stored COA already loops, which this check must not hang on either.
    if (seen.has(cursor)) return { ok: false, violation: "cycle", chain };
    seen.add(cursor);
    chain.push(cursor);
    if (chain.length > ACCOUNT_HIERARCHY_MAX_DEPTH) {
      return { ok: false, violation: "too_deep", chain };
    }
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return { ok: true, chain };
}

/** Readable, field-agnostic message shared by the API (422) and the UI. */
export function describeAccountHierarchyViolation(
  violation: AccountHierarchyViolation,
  context: { accountId: string; parentId?: string | null; chain?: readonly string[] },
): string {
  const parent = context.parentId ?? "";
  const chain = context.chain?.length ? ` (${context.chain.join(" → ")})` : "";
  switch (violation) {
    case "self_parent":
      return `Account ${context.accountId} cannot be its own parent`;
    case "unknown_parent":
      return `Parent account "${parent}" does not exist in this workspace`;
    case "archived_parent":
      return `Parent account "${parent}" is archived — restore it before nesting an account under it`;
    case "cycle":
      return `Nesting account ${context.accountId} under "${parent}" would create a hierarchy cycle${chain}`;
    case "too_deep":
      return `Account hierarchy cannot exceed ${ACCOUNT_HIERARCHY_MAX_DEPTH} levels${chain}`;
    default:
      return `Invalid parent account "${parent}" for account ${context.accountId}`;
  }
}

/** Ancestor ids of `accountId` (nearest first). Safe on a stored cycle. */
export function accountAncestorIds(
  nodes: readonly AccountHierarchyNode[],
  accountId: string,
): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>([accountId]);
  const ancestors: string[] = [];
  let cursor = byId.get(accountId)?.parentId ?? null;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    ancestors.push(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return ancestors;
}

/**
 * Ids of accounts that host active children — the header/summary accounts.
 *
 * Posting a journal line to one is refused by the backend (a rollup would count the
 * same balance twice), so pickers filter them out with this set. `deletedAt` is
 * honoured: an archived child must not keep its parent classified as a header.
 */
export function summaryAccountIds(accounts: readonly AccountHierarchyNode[]): ReadonlySet<string> {
  const byId = new Map(accounts.map((node) => [node.id, node]));
  const summary = new Set<string>();
  for (const node of accounts) {
    // An archived child is not part of the active tree, so it neither makes its
    // parent a summary account nor (being archived itself) exists to host children.
    if (!node.parentId || node.deletedAt) continue;
    const parent = byId.get(node.parentId);
    if (!parent || parent.deletedAt) continue;
    summary.add(node.parentId);
  }
  return summary;
}
