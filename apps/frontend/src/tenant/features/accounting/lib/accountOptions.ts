import type { Account } from "@mms/shared";

/** Active accounts of the given type(s), by code, as select options. */
export function accountOptions(accounts: Account[], types?: Account["type"] | Account["type"][]) {
  const allowed = types === undefined ? null : Array.isArray(types) ? types : [types];
  return accounts
    .filter((account) => account.isActive !== false && (!allowed || allowed.includes(account.type)))
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }));
}
