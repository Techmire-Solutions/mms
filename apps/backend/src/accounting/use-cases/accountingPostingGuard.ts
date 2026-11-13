import type { User, JournalEntry } from "@mms/shared";
import { ACCOUNTING_ERROR_CODES } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { canPostAccounting } from "../../lib/rbacCanModuleHelpers.js";
import { journalEntryContentChanged } from "./accountingLedgerGuards.js";

/**
 * Draft ⇄ posted boundary.
 *
 * `accounting.write` authorises drafting (creating and editing a voucher that is
 * not final). `accounting.post` is what makes a voucher immutable, so a custom
 * role can be a Junior Accountant (write without post) while a Senior Accountant
 * holds both. Without this gate the only difference between the two is UI copy —
 * a writer could `PUT /entries/bulk` a `status: "posted"` voucher directly.
 *
 * An unchanged re-save of an already-posted voucher stays allowed: it does not
 * change the ledger record (the immutability guard already rejects content
 * changes), so requiring `post` there would break legitimate bulk saves by a
 * draft-only role that merely re-sends the page it read.
 */
export type StoredEntryLoader = (id: string) => Promise<JournalEntry | null>;

export async function assertEntriesPostable(
  user: User | undefined,
  entries: readonly JournalEntry[],
  loadStored: StoredEntryLoader,
): Promise<void> {
  if (canPostAccounting(user as User)) return;

  for (const entry of entries) {
    if (entry.status !== "posted") continue;
    const stored = entry.id ? await loadStored(entry.id) : null;
    const unchangedPosted =
      stored?.status === "posted" && !journalEntryContentChanged(entry, stored);
    if (unchangedPosted) continue;
    throw Object.assign(
      new HttpDomainError(
        403,
        "forbidden",
        "Posting a journal entry requires posting authority — save it as a draft or ask a senior accountant",
      ),
      { code: ACCOUNTING_ERROR_CODES.postRequired },
    );
  }
}
