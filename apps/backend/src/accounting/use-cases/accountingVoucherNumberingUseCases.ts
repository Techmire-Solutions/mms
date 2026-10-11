import {
  formatVoucherNumber,
  voucherNumberingUpdateSchema,
  type VoucherNumbering,
  type VoucherNumberingUpdate,
} from "@mms/shared";
import { requireTenant } from "../../lib/tenantContext.js";
import {
  peekVoucherSequence,
  saveVoucherNumbering,
} from "../../db/repositories/accountingVoucherRepository.js";

/** Current numbering format plus a preview of the next number for `date`'s period. */
export async function loadVoucherNumbering(date?: string): Promise<VoucherNumbering> {
  const { config, period, lastValue } = await peekVoucherSequence(requireTenant(), date);
  const { updatedAt, ...format } = config;
  return {
    ...format,
    currentSequence: lastValue,
    periodYear: period.periodYear,
    nextVoucherNumber: formatVoucherNumber(lastValue + 1, format, period.printYear),
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
  await saveVoucherNumbering(tenant, voucherNumberingUpdateSchema.parse(input));
  const { broadcastTenantUpdate } = await import("../../services/websocketService.js");
  broadcastTenantUpdate(tenant, "collection", "accounting_voucher_numbering");
  return loadVoucherNumbering();
}
