import {
  formatVoucherNumber,
  voucherNumberingUpdateSchema,
  type VoucherNumbering,
  type VoucherNumberingUpdate,
} from "@mms/contracts";
import { requireTenant } from "@mms/be-core/http";
import {
  peekVoucherSequence,
  saveVoucherNumbering,
} from "../repository/accountingVoucherRepository.js";

/** Current numbering format plus a preview of the next number for `date`'s period. */
export async function loadVoucherNumbering(date?: string): Promise<VoucherNumbering> {
  const { config, period, lastValue } = await peekVoucherSequence(requireTenant(), date);
  const { updatedAt, ...format } = config;
  return {
    ...format,
    currentSequence: lastValue,
    periodYear: period.periodYear,
    nextVoucherNumber: formatVoucherNumber(
      lastValue + 1,
      format,
      period.printYear,
      period.printMonth,
    ),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/**
 * Changing the printed format or rollover moves allocation to another counter,
 * which is seeded from existing refs in that format — issued numbers are never
 * rewritten.
 */
export async function upsertVoucherNumbering(
  input: VoucherNumberingUpdate,
): Promise<VoucherNumbering> {
  const tenant = requireTenant();
  // The repository appends the before/after audit row in the same transaction:
  // numbering is a ledger control, so the event belongs with the write itself.
  await saveVoucherNumbering(tenant, voucherNumberingUpdateSchema.parse(input));
  const { broadcastTenantUpdate } = await import("@mms/be-core/realtime");
  broadcastTenantUpdate(tenant, "collection", "accounting_voucher_numbering");
  return loadVoucherNumbering();
}
