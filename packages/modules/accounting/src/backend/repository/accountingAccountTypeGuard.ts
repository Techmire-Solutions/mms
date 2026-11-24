import { and, eq, inArray } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/contracts";
import { accountingAccounts } from "@mms/db/schema";
import type { TenantTransaction } from "@mms/db/context";
import { ConflictError } from "@mms/be-core/http/errors";
import { postedLineCountsByAccount } from "./accountingAccountLedgerLines.js";

/**
 * An account's `type` drives every report and statement classification. Changing
 * it after entries have posted silently reclassifies history, so a used account's
 * type is immutable (corrections go through a new account or a documented
 * migration); harmless fields (`name`, `subtype`, `code`, description, FX, parent)
 * stay editable.
 *
 * Runs under the caller's transaction and reads the stored row `FOR UPDATE` so a
 * concurrent posting cannot interleave with the change.
 */
export async function assertNoPostedAccountTypeChange(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Account[],
): Promise<void> {
  const ids = dedupeTrimmedIds(records.map((record) => record.id));
  if (ids.length === 0) return;

  const stored = await tx
    .select({ id: accountingAccounts.id, type: accountingAccounts.type })
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.workspaceSubdomain, subdomain),
        inArray(accountingAccounts.id, ids),
      ),
    )
    .for("update");
  const byId = new Map(stored.map((row) => [row.id, row.type]));

  const counts = await postedLineCountsByAccount(tx, subdomain, ids);
  for (const record of records) {
    const previousType = byId.get(record.id);
    if (!previousType || previousType === record.type) continue;
    if ((counts.get(record.id) ?? 0) > 0) {
      throw new ConflictError(
        `Cannot change the type of account "${record.code || record.id}": it has posted journal entries`,
        "account_type_in_use",
      );
    }
  }
}
