import type { Account, HedgeRelationshipCreate } from "@mms/shared";
import type { AccountingHedgesStore } from "../repository/accountingHedgesRepositoryAdapter.js";
import { unprocessable } from "./hedgeErrors.js";

/**
 * Which account type each hedge role may point at.
 *
 * The FK proves the account exists; the role proves which statement the posting
 * lands on. Designation, settlement and reserve reclassification all go through
 * here so a later action cannot smuggle the derivative into a Revenue account or
 * reclassify an OCI reserve into an Asset.
 */
export const HEDGE_ACCOUNT_ROLES = {
  instrumentAccountId: ["Asset", "Liability"],
  reserveAccountId: ["Equity"],
  pnlAccountId: ["Revenue", "Expense"],
  /** Cash settlement of the forward: the value is received or paid in cash. */
  cashAccountId: ["Asset"],
  /** Where the settled OCI reserve is reclassified (IFRS 9.6.5.11(d)(ii)). */
  reclassificationAccountId: ["Revenue", "Expense"],
} as const satisfies Record<string, readonly string[]>;

export type HedgeAccountRole = keyof typeof HEDGE_ACCOUNT_ROLES;

type RoleStore = Pick<AccountingHedgesStore, "findAccountsByIds">;

/** One human-readable problem for an account/role mismatch, or null when it fits. */
export function hedgeAccountProblem(
  account: Account | undefined,
  accountId: string,
  allowed: readonly string[],
): string | null {
  if (!account) return `unknown or archived account "${accountId}"`;
  if (account.isActive === false) return `${account.code} ${account.name} is deactivated`;
  if (!allowed.includes(account.type)) {
    return `${account.code} ${account.name} is type ${account.type}, expected ${allowed.join(" or ")}`;
  }
  return null;
}

/**
 * Validates one account against one role, throwing a 422 that names the account and
 * the expected types. Used by settlement and reclassification, which are separate
 * user actions long after designation.
 */
export async function assertHedgeAccountRole(
  store: RoleStore,
  tenant: string,
  role: HedgeAccountRole,
  accountId: string,
): Promise<void> {
  const [account] = await store.findAccountsByIds(tenant, [accountId]);
  const problem = hedgeAccountProblem(account, accountId, HEDGE_ACCOUNT_ROLES[role]);
  if (problem) throw unprocessable(`${role}: ${problem}`);
}

/** Designation-time validation: every role the relationship names must fit. */
export async function assertHedgeAccounts(
  store: RoleStore,
  tenant: string,
  hedge: HedgeRelationshipCreate,
): Promise<void> {
  const fields = ["instrumentAccountId", "reserveAccountId", "pnlAccountId"] as const;
  const ids = fields
    .map((field) => hedge[field])
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const byId = new Map((await store.findAccountsByIds(tenant, ids)).map((a) => [a.id, a]));
  const problems: string[] = [];
  for (const field of fields) {
    const accountId = hedge[field];
    if (typeof accountId !== "string" || !accountId) continue;
    const problem = hedgeAccountProblem(byId.get(accountId), accountId, HEDGE_ACCOUNT_ROLES[field]);
    if (problem) problems.push(`${field}: ${problem}`);
  }
  if (problems.length > 0) {
    throw unprocessable(`Invalid hedge accounts — ${problems.join("; ")}`);
  }
}
