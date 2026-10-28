import { sql } from "drizzle-orm";
import { inferIsMonetaryAccount, type Account } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";

type FxFields = Pick<Account, "isMonetary" | "accountCurrency" | "allowRevaluation">;

const hasFxFields = (record: FxFields): boolean =>
  record.isMonetary !== undefined ||
  record.accountCurrency !== undefined ||
  record.allowRevaluation !== undefined;

/** IAS 21 columns for a newly inserted account; omitted flags fall back to defaults. */
export function accountFxInsertValues(record: Account) {
  return {
    isMonetary: record.isMonetary ?? inferIsMonetaryAccount(record),
    accountCurrency: record.accountCurrency ?? null,
    allowRevaluation: record.allowRevaluation ?? true,
  };
}

/**
 * IAS 21 columns to overwrite on an existing account: only the fields the
 * caller sent, so a client that predates them never resets stored flags.
 */
export function accountFxUpdateSet(record: FxFields) {
  return {
    ...(record.isMonetary !== undefined ? { isMonetary: record.isMonetary } : {}),
    ...(record.accountCurrency !== undefined ? { accountCurrency: record.accountCurrency } : {}),
    ...(record.allowRevaluation !== undefined ? { allowRevaluation: record.allowRevaluation } : {}),
  };
}

/**
 * After a bulk upsert that leaves the IAS 21 columns untouched on conflict,
 * apply the flags each record explicitly carries in one UPDATE … FROM (VALUES).
 */
export async function applyExplicitAccountFxFlags(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Account[],
): Promise<void> {
  const explicit = records.filter(hasFxFields);
  if (explicit.length === 0) return;
  const rows = explicit.map(
    (
      r,
    ) => sql`(${r.id}::text, ${r.isMonetary ?? null}::boolean, ${r.accountCurrency !== undefined}::boolean,
      ${r.accountCurrency ?? null}::varchar, ${r.allowRevaluation ?? null}::boolean)`,
  );
  await tx.execute(sql`
    UPDATE accounting_accounts a
    SET is_monetary = COALESCE(v.is_monetary, a.is_monetary),
        account_currency = CASE WHEN v.set_currency THEN v.account_currency ELSE a.account_currency END,
        allow_revaluation = COALESCE(v.allow_revaluation, a.allow_revaluation)
    FROM (VALUES ${sql.join(rows, sql`, `)})
      AS v(id, is_monetary, set_currency, account_currency, allow_revaluation)
    WHERE a.workspace_subdomain = ${subdomain} AND a.id = v.id`);
}
