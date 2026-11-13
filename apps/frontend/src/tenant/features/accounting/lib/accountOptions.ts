import { summaryAccountIds, type Account } from "@mms/shared";

/**
 * Active accounts of the given type(s), by code, as select options.
 *
 * Header/summary accounts (those that have sub-accounts) are excluded: posting a
 * journal line to one is rejected by the API, so offering it in a picker only
 * produces a failed save.
 */
export function accountOptions(accounts: Account[], types?: Account["type"] | Account["type"][]) {
  const allowed = types === undefined ? null : Array.isArray(types) ? types : [types];
  const summary = summaryAccountIds(accounts);
  return accounts
    .filter(
      (account) =>
        account.isActive !== false &&
        !summary.has(account.id) &&
        (!allowed || allowed.includes(account.type)),
    )
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }));
}
