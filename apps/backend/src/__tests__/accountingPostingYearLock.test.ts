import { describe, expect, it } from "vitest";
import type { FiscalYear, JournalEntry } from "@mms/shared";
import { postingYearIds } from "../accounting/ledgerPosting/fiscalYearPostingLock.js";

/**
 * The close locks one advisory key per fiscal year. A posting that is *dated* in
 * year B but *declared* into year A (`fiscal_year_id`) used to lock only B, so a
 * concurrent close of A ran unprotected and the entry could commit into a closed
 * year. The lock set must therefore cover both.
 */
const years: FiscalYear[] = [
  {
    id: "fy-2026",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
  {
    id: "fy-2027",
    label: "FY 2027",
    startDate: "2027-01-01",
    endDate: "2027-12-31",
    status: "active",
  },
];

const entry = (overrides: Partial<JournalEntry>): JournalEntry =>
  ({
    id: "je-1",
    date: "2026-05-01",
    status: "posted",
    fiscal_year: "",
    lines: [],
    tags: [],
    attachments: [],
    ...overrides,
  }) as JournalEntry;

describe("postingYearIds", () => {
  it("locks the year the date falls in", () => {
    expect(postingYearIds([entry({ date: "2026-05-01" })], years)).toEqual(["fy-2026"]);
  });

  it("locks both the declared year and the year of the date", () => {
    const ids = postingYearIds(
      [entry({ date: "2027-02-01", fiscal_year_id: "fy-2026", fiscal_year: "FY 2026" })],
      years,
    );
    expect(ids.sort()).toEqual(["fy-2026", "fy-2027"]);
  });

  it("locks a declared id the list does not contain yet", () => {
    // A year created after the caller read the list must still be locked.
    expect(postingYearIds([entry({ fiscal_year_id: "fy-new" })], years)).toContain("fy-new");
  });

  it("locks every distinct year of a batch", () => {
    const ids = postingYearIds(
      [entry({ id: "a", date: "2026-03-01" }), entry({ id: "b", date: "2027-03-01" })],
      years,
    );
    expect(ids.sort()).toEqual(["fy-2026", "fy-2027"]);
  });
});
