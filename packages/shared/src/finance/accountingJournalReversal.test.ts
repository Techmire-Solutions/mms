import { describe, expect, it } from "vitest";
import {
  defaultJournalReversalDate,
  isPostingDateLocked,
  isManuallyReversibleJournalSource,
  isPriorPeriodJournalReversal,
  journalReversalRequestSchema,
  validateJournalReversalDate,
} from "./accountingJournalReversal.js";

const fy = (id: string, startDate: string, endDate: string, status: string) => ({
  id,
  label: id,
  startDate,
  endDate,
  status,
});

const FY2025_CLOSED = fy("fy25", "2025-01-01", "2025-12-31", "closed");
const FY2026_OPEN = fy("fy26", "2026-01-01", "2026-12-31", "active");
const FY2026_CLOSED = fy("fy26", "2026-01-01", "2026-12-31", "closed");
const FY2027_OPEN = fy("fy27", "2027-01-01", "2027-12-31", "upcoming");

describe("validateJournalReversalDate", () => {
  it("accepts the original posting date while its period is open (Rule A)", () => {
    expect(validateJournalReversalDate("2026-09-15", "2026-09-15", [FY2026_OPEN])).toBeNull();
    expect(validateJournalReversalDate("2026-09-15", "2026-10-08", [FY2026_OPEN])).toBeNull();
  });

  it("rejects a date inside a closed period (Rule B/C)", () => {
    expect(
      validateJournalReversalDate("2025-09-15", "2025-09-15", [FY2025_CLOSED, FY2026_OPEN]),
    ).toBe("closed_period");
  });

  it("rejects dates before the original, malformed dates and unconfigured periods", () => {
    expect(validateJournalReversalDate("2026-09-15", "2026-09-14", [FY2026_OPEN])).toBe(
      "before_original",
    );
    expect(validateJournalReversalDate("2026-09-15", "2026-02-30", [FY2026_OPEN])).toBe(
      "invalid_date",
    );
    expect(validateJournalReversalDate("2026-09-15", "2028-01-05", [FY2026_OPEN])).toBe(
      "outside_fiscal_years",
    );
  });

  it("leaves a workspace without fiscal years unregulated", () => {
    expect(validateJournalReversalDate("2026-09-15", "2026-09-15", [])).toBeNull();
  });
});

describe("defaultJournalReversalDate", () => {
  it("defaults to the original date when its period is open", () => {
    expect(defaultJournalReversalDate("2026-09-15", "2026-10-08", [FY2026_OPEN])).toBe(
      "2026-09-15",
    );
  });

  it("defaults to today when the original period is closed and today is open", () => {
    expect(
      defaultJournalReversalDate("2025-09-15", "2026-10-08", [FY2025_CLOSED, FY2026_OPEN]),
    ).toBe("2026-10-08");
  });

  it("returns no default when today is not postable either", () => {
    expect(
      defaultJournalReversalDate("2026-09-15", "2026-10-08", [FY2026_CLOSED, FY2027_OPEN]),
    ).toBe("");
  });
});

describe("isPriorPeriodJournalReversal / isPostingDateLocked", () => {
  it("flags a reversal of a closed prior-year entry into another year", () => {
    expect(
      isPriorPeriodJournalReversal("2025-09-15", "2026-10-08", [FY2025_CLOSED, FY2026_OPEN]),
    ).toBe(true);
    expect(isPriorPeriodJournalReversal("2026-09-15", "2026-10-08", [FY2026_OPEN])).toBe(false);
  });

  it("reports locked dates", () => {
    expect(isPostingDateLocked([FY2025_CLOSED], "2025-03-01")).toBe(true);
    expect(isPostingDateLocked([FY2026_OPEN], "2026-03-01")).toBe(false);
    expect(isPostingDateLocked([FY2026_OPEN], "2030-03-01")).toBe(true);
    expect(isPostingDateLocked([], "2030-03-01")).toBe(false);
  });
});

describe("journalReversalRequestSchema", () => {
  it("requires a non-blank reason and a real date, and rejects unknown keys", () => {
    expect(
      journalReversalRequestSchema.safeParse({ date: "2026-10-08", reason: "Wrong account" })
        .success,
    ).toBe(true);
    expect(
      journalReversalRequestSchema.safeParse({ date: "2026-10-08", reason: "   " }).success,
    ).toBe(false);
    expect(journalReversalRequestSchema.safeParse({ date: "2026-10-08" }).success).toBe(false);
    expect(journalReversalRequestSchema.safeParse({ date: "x", reason: "r" }).success).toBe(false);
    expect(
      journalReversalRequestSchema.safeParse({
        date: "2026-10-08",
        reason: "r",
        deleteOriginal: true,
      }).success,
    ).toBe(false);
  });
});

describe("isManuallyReversibleJournalSource", () => {
  it("blocks Finance-owned and closing postings, allows manual, opening and reversal entries", () => {
    expect(["invoice", "payment", "closing"].map(isManuallyReversibleJournalSource)).toEqual([
      false,
      false,
      false,
    ]);
    expect(
      ["manual", "opening", "reversal", undefined].map(isManuallyReversibleJournalSource),
    ).toEqual([true, true, true, true]);
  });
});
