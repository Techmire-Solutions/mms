import type { ObligationsRepository } from "../repository/obligationsRepository.js";
import type { ObligationCollection } from "@mms/shared";
import { assertReceiptHasWakala } from "../domain/obligationWriteGuards.js";
import { ValidationError } from "../../lib/httpErrors.js";

/**
 * Rejects receipts whose type/representative pair has no wakala.
 *
 * The rule lived only in the browser's representative picker; without it the receipt saved and
 * the ledger credited 100 % to the default income account, turning a wakala liability into
 * income. One wakala read per write batch, not per receipt.
 */
export async function guardReceipts(
  repo: ObligationsRepository,
  tenant: string,
  records: readonly ObligationCollection[],
): Promise<void> {
  if (records.length === 0) return;
  const wakalas = await repo.listWakalaTypesByWorkspace(tenant);
  for (const record of records) {
    assertReceiptHasWakala(
      {
        obligation_type_id: record.obligation_type_id,
        mujtahid_representative_id: record.mujtahid_representative_id,
      },
      wakalas,
    );
  }
}

/**
 * Assigns server-authoritative receipt numbers to records with a blank `receipt_no`.
 *
 * The browser used to derive the next number from the list it happened to hold, so two
 * clients minted the same receipt number. The allocator claims a disjoint range under the
 * counter row lock (inside the caller's save transaction), so this is concurrency-safe.
 * A blank number with automatic numbering off is a validation error.
 */
export async function fillBlankReceiptNumbers(
  repo: ObligationsRepository,
  tenant: string,
  records: readonly ObligationCollection[],
): Promise<ObligationCollection[]> {
  const blankIndexes: number[] = [];
  for (let index = 0; index < records.length; index += 1) {
    if (!records[index]?.receipt_no?.trim()) blankIndexes.push(index);
  }
  if (blankIndexes.length === 0) return records.map((record) => ({ ...record }));

  const allocator = repo.allocateReceiptNumbers;
  if (!allocator) {
    throw new ValidationError(
      "Receipt number is required when automatic receipt numbering is disabled",
    );
  }

  const next = records.map((record) => ({ ...record }));

  // Group blank records by the calendar year of their `received_date` so a backdated
  // receipt continues that year's sequence instead of the server's year (each year is a
  // separate counter bucket under `annual_calendar` rollover). Records with a malformed
  // or missing date fall back to the server year.
  const byYear = new Map<string, number[]>();
  for (const index of blankIndexes) {
    const received = records[index]?.received_date;
    const year = received ? received.slice(0, 4) : "";
    const list = byYear.get(year);
    if (list) list.push(index);
    else byYear.set(year, [index]);
  }

  for (const [year, indexes] of byYear) {
    const date = year ? records[indexes[0]]?.received_date : undefined;
    const numbers = await allocator(tenant, { date, count: indexes.length });
    if (!numbers) {
      throw new ValidationError(
        "Receipt number is required when automatic receipt numbering is disabled",
      );
    }
    indexes.forEach((recordIndex, position) => {
      const number = numbers[position];
      if (!number) {
        throw new Error("Receipt number allocator returned fewer numbers than requested");
      }
      next[recordIndex] = { ...next[recordIndex], receipt_no: number };
    });
  }

  return next;
}
