import { describe, expect, it } from "vitest";
import { limitReceiptPrintBatch, MAX_RECEIPT_PRINT_BATCH } from "./receiptPrintBatch";

describe("limitReceiptPrintBatch", () => {
  it("returns the whole selection when it fits the bound", () => {
    const items = Array.from({ length: 5 }, (_, index) => index);
    const batch = limitReceiptPrintBatch(items);
    expect(batch.items).toEqual(items);
    expect(batch.omitted).toBe(0);
    expect(batch.capped).toBe(false);
  });

  it("caps large batches and reports what was omitted", () => {
    const items = Array.from({ length: MAX_RECEIPT_PRINT_BATCH + 25 }, (_, index) => index);
    const batch = limitReceiptPrintBatch(items);
    expect(batch.items).toHaveLength(MAX_RECEIPT_PRINT_BATCH);
    expect(batch.omitted).toBe(25);
    expect(batch.capped).toBe(true);
  });

  it("does not mutate the caller's selection", () => {
    const items = Array.from({ length: MAX_RECEIPT_PRINT_BATCH + 1 }, (_, index) => index);
    limitReceiptPrintBatch(items);
    expect(items).toHaveLength(MAX_RECEIPT_PRINT_BATCH + 1);
  });
});
