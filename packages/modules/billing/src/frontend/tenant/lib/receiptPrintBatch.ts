/**
 * Batch receipt printing bound.
 *
 * The print window renders one template page per selected invoice twice (the
 * offscreen 1:1 print source and the visible preview), so an unbounded batch turns
 * a "print all overdue invoices" action into hundreds of pages in the browser's
 * DOM and print spooler. The batch is capped and the caller must surface what was
 * dropped instead of silently printing a partial set.
 */
export const MAX_RECEIPT_PRINT_BATCH = 100;

export interface ReceiptPrintBatch<T> {
  items: T[];
  omitted: number;
  capped: boolean;
}

/** Splits a selection into the printable batch and the count that was omitted. */
export function limitReceiptPrintBatch<T>(
  items: readonly T[],
  max = MAX_RECEIPT_PRINT_BATCH,
): ReceiptPrintBatch<T> {
  if (items.length <= max) return { items: [...items], omitted: 0, capped: false };
  return { items: items.slice(0, max), omitted: items.length - max, capped: true };
}
