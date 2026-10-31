/**
 * @file obligationDistributionAccounts.ts
 * @description Validates the ledger account mapped to each wakala distribution.
 */

import type { ObligationDistribution } from "@mms/shared";
import type { ObligationsRepository } from "../repository/obligationsRepository.js";

/**
 * Rejects distributions mapped to an account the workspace does not have.
 *
 * The column carries no foreign key, and the account it names ends up on a
 * journal line, so an id that is stale, archived, or simply wrong would post
 * real money against an account nobody can see. Archived accounts are excluded
 * because the listing returns active accounts only.
 */
export async function assertDistributionAccountsValid(
  repo: ObligationsRepository,
  tenant: string,
  records: readonly ObligationDistribution[],
): Promise<void> {
  const mapped = records
    .map((record) => (record.account_id ?? "").trim())
    .filter((accountId) => accountId.length > 0);
  if (mapped.length === 0) return;

  const known = new Set(await repo.listLedgerAccountIds(tenant));
  const unknown = [...new Set(mapped)].filter((accountId) => !known.has(accountId));
  if (unknown.length === 0) return;

  const error = new Error(
    `Distribution account not found in the chart of accounts: ${unknown.join(", ")}`,
  ) as Error & { statusCode: number };
  error.statusCode = 400;
  throw error;
}
