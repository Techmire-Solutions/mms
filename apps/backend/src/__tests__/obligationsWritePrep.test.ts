import { describe, expect, it, vi } from "vitest";
import {
  fillBlankReceiptNumbers,
  guardReceipts,
} from "../obligations/use-cases/obligationCollectionWritePrep.js";
import type { ObligationsRepository } from "../obligations/repository/obligationsRepository.js";
import type { ObligationCollection } from "@mms/shared";

const receipt = (overrides: Partial<ObligationCollection> = {}): ObligationCollection =>
  ({
    id: "oc-1",
    receipt_no: "",
    received_date: "2026-09-01",
    sender_id: "c-1",
    reference_id: null,
    amount: 100,
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "type-1",
    mujtahid_representative_id: "rep-1",
    received_by: "u-1",
    ...overrides,
  }) as ObligationCollection;

function repoWith(overrides: Partial<ObligationsRepository> = {}): ObligationsRepository {
  return {
    listWakalaTypesByWorkspace: vi
      .fn()
      .mockResolvedValue([
        { id: "wt-1", mujtahid_representative_id: "rep-1", obligation_type_id: "type-1" },
      ]),
    allocateReceiptNumbers: vi.fn().mockResolvedValue(["REC-2026-0001"]),
    ...overrides,
  } as ObligationsRepository;
}

describe("obligation collection write prep", () => {
  it("allocates a receipt number for a blank receipt_no", async () => {
    const repo = repoWith();
    const result = await fillBlankReceiptNumbers(repo, "demo", [receipt()]);

    expect(result[0]?.receipt_no).toBe("REC-2026-0001");
    expect(repo.allocateReceiptNumbers).toHaveBeenCalledWith("demo", {
      date: "2026-09-01",
      count: 1,
    });
  });

  it("keeps existing receipt numbers and only allocates for blanks", async () => {
    const repo = repoWith({
      allocateReceiptNumbers: vi.fn().mockResolvedValue(["REC-2026-0002"]),
    });
    const result = await fillBlankReceiptNumbers(repo, "demo", [
      receipt({ receipt_no: "REC-2026-0001" }),
      receipt({ id: "oc-2" }),
    ]);

    expect(result[0]?.receipt_no).toBe("REC-2026-0001");
    expect(result[1]?.receipt_no).toBe("REC-2026-0002");
    expect(repo.allocateReceiptNumbers).toHaveBeenCalledWith("demo", {
      date: "2026-09-01",
      count: 1,
    });
  });

  it("groups blank receipts by received_date year and allocates per year", async () => {
    const repo = repoWith({
      allocateReceiptNumbers: vi
        .fn()
        .mockResolvedValueOnce(["REC-2026-0001"])
        .mockResolvedValueOnce(["REC-2025-0002"]),
    });

    const result = await fillBlankReceiptNumbers(repo, "demo", [
      receipt({ id: "oc-2026" }),
      receipt({ id: "oc-2025", received_date: "2025-12-31" }),
    ]);

    expect(repo.allocateReceiptNumbers).toHaveBeenNthCalledWith(1, "demo", {
      date: "2026-09-01",
      count: 1,
    });
    expect(repo.allocateReceiptNumbers).toHaveBeenNthCalledWith(2, "demo", {
      date: "2025-12-31",
      count: 1,
    });
    expect(result[0]?.receipt_no).toBe("REC-2026-0001");
    expect(result[1]?.receipt_no).toBe("REC-2025-0002");
  });

  it("returns a copy without calling the allocator when nothing is blank", async () => {
    const repo = repoWith();
    const result = await fillBlankReceiptNumbers(repo, "demo", [
      receipt({ receipt_no: "REC-2026-0001" }),
    ]);

    expect(result[0]?.receipt_no).toBe("REC-2026-0001");
    expect(repo.allocateReceiptNumbers).not.toHaveBeenCalled();
  });

  it("rejects a blank receipt_no when automatic numbering is disabled", async () => {
    const repo = repoWith({ allocateReceiptNumbers: undefined });

    await expect(fillBlankReceiptNumbers(repo, "demo", [receipt()])).rejects.toThrow(
      /receipt number is required/i,
    );
  });

  it("rejects a receipt whose type/representative pair has no wakala", async () => {
    const repo = repoWith({
      listWakalaTypesByWorkspace: vi
        .fn()
        .mockResolvedValue([
          { id: "wt-9", mujtahid_representative_id: "rep-9", obligation_type_id: "type-9" },
        ]),
    });

    await expect(guardReceipts(repo, "demo", [receipt()])).rejects.toThrow(
      /no wakala is configured/i,
    );
  });
});
