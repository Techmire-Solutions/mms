import { randomUUID } from "node:crypto";
import type { JournalEntry } from "@mms/shared";
import type { AccountingRepository } from "../repository/accountingRepository.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";

type VoucherAllocator = Pick<AccountingRepository, "allocateVoucherNumbers">;

/**
 * Fills blank refs with server-issued voucher numbers. Call inside the entry
 * write transaction so the counter lock and the insert commit together.
 * Stored entries keep their existing ref; blank refs are grouped by voucher
 * date so calendar and fiscal rollover each draw from the right counter.
 */
export async function assignVoucherRefs(
  repo: VoucherAllocator,
  tenant: string,
  entries: readonly JournalEntry[],
  storedRefById: ReadonlyMap<string, string | undefined> = new Map(),
): Promise<JournalEntry[]> {
  const reserved = new Set<string>();
  for (const entry of entries) {
    const ref = entry.ref?.trim();
    if (!ref) continue;
    if (reserved.has(ref))
      throw new ConflictError(`Duplicate reference "${ref}" within the same batch`);
    reserved.add(ref);
  }

  const resolved = entries.map((entry) => ({
    ...entry,
    ref: entry.ref?.trim() || storedRefById.get(entry.id)?.trim() || "",
  }));
  const pendingByDate = new Map<string, JournalEntry[]>();
  for (const entry of resolved) {
    if (entry.ref) continue;
    const date = entry.date ?? "";
    pendingByDate.set(date, [...(pendingByDate.get(date) ?? []), entry]);
  }

  for (const pending of pendingByDate.values()) {
    const refs = repo.allocateVoucherNumbers
      ? await repo.allocateVoucherNumbers(tenant, {
          date: pending[0].date,
          count: pending.length,
          reserved,
        })
      : pending.map(() => `JE-${randomUUID().slice(0, 8)}`);
    if (!refs)
      throw new ValidationError(
        "A reference number is required because automatic voucher numbering is off",
      );
    pending.forEach((entry, index) => {
      entry.ref = refs[index];
      reserved.add(refs[index]);
    });
  }
  return resolved;
}
