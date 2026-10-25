import { describe, expect, it } from "vitest";
import type { FiscalYear, JournalEntry } from "@mms/shared";
import {
  assertJournalEntryPeriodOpen,
  prepareJournalEntryForPersist,
  journalEntryContentChanged,
} from "../accounting/use-cases/accountingLedgerGuards.js";

const years: FiscalYear[] = [
  {
    id: "fy-open",
    label: "2026-2027",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
    status: "active",
  },
  {
    id: "fy-shut",
    label: "2025-2026",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    status: "closed",
  },
];

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "je-1",
    date: "2026-08-01",
    ref: "JE-0001",
    description: "Fee receipt",
    status: "posted",
    created_by: "u1",
    fiscal_year: "2026-2027",
    lines: [
      { id: "l1", account_id: "a1", debit: 100, credit: 0, description: "" },
      { id: "l2", account_id: "a2", debit: 0, credit: 100, description: "" },
    ],
    tags: [],
    attachments: [],
    ...overrides,
  };
}

describe("prepareJournalEntryForPersist", () => {
  it("fills fiscal_year_id from the label and defaults source_type to manual", () => {
    const prepared = prepareJournalEntryForPersist(entry(), years);
    expect(prepared.fiscal_year_id).toBe("fy-open");
    expect(prepared.fiscal_year).toBe("2026-2027");
    expect(prepared.source_type).toBe("manual");
  });

  it("resolves the fiscal year from the entry date when no reference is given", () => {
    const prepared = prepareJournalEntryForPersist(
      entry({ date: "2026-08-01", fiscal_year: "", fiscal_year_id: undefined }),
      years,
    );
    expect(prepared.fiscal_year_id).toBe("fy-open");
    expect(prepared.fiscal_year).toBe("2026-2027");
  });

  it("rejects posted unbalanced entries", () => {
    expect(() =>
      prepareJournalEntryForPersist(
        entry({
          lines: [{ id: "l1", account_id: "a1", debit: 100, credit: 0, description: "" }],
        }),
        years,
      ),
    ).toThrow(/matching debit and credit/);
  });

  it("allows unbalanced drafts", () => {
    const prepared = prepareJournalEntryForPersist(
      entry({
        status: "draft",
        lines: [{ id: "l1", account_id: "a1", debit: 25, credit: 0, description: "" }],
      }),
      years,
    );
    expect(prepared.status).toBe("draft");
  });

  it("rejects malformed and impossible dates", () => {
    // Reports compare `date` lexicographically, so '2026-8-1' sorts into the
    // wrong period and '2026-02-31' is not a day at all.
    for (const date of ["2026-8-1", "not-a-date", "2026-02-31", "2026-13-01", ""]) {
      expect(() => prepareJournalEntryForPersist(entry({ date }), years)).toThrow(
        /real calendar date/,
      );
    }
  });

  it("does not apply the period lock, so unchanged re-saves stay persistable", () => {
    // Whole-collection Work-tier saves re-send rows from closed years; the lock
    // is applied separately, to new-or-changed rows only.
    const prepared = prepareJournalEntryForPersist(
      entry({ fiscal_year: "fy-shut", date: "2026-01-15" }),
      years,
    );
    expect(prepared.fiscal_year_id).toBe("fy-shut");
  });
});

describe("assertJournalEntryPeriodOpen", () => {
  it("rejects writes against a declared closed fiscal year", () => {
    expect(() =>
      assertJournalEntryPeriodOpen(entry({ fiscal_year: "fy-shut", date: "2026-01-15" }), years),
    ).toThrow(/closed fiscal year/);
  });

  it("rejects an entry dated inside a closed year when no reference is declared", () => {
    // Regression: omitting fiscal_year/fiscal_year_id used to bypass the lock
    // entirely, so a posting dated inside a closed period was accepted.
    expect(() =>
      assertJournalEntryPeriodOpen(
        entry({ date: "2025-09-15", fiscal_year: "", fiscal_year_id: undefined }),
        years,
      ),
    ).toThrow(/closed fiscal year/);
  });

  it("rejects an entry dated inside a closed year even when labelled as the open year", () => {
    // This is what the journal form actually produced: the active fiscal year is
    // stamped on whatever date the user picked, so the declared label alone could
    // never catch a back-dated posting.
    expect(() =>
      assertJournalEntryPeriodOpen(entry({ date: "2025-09-15", fiscal_year: "2026-2027" }), years),
    ).toThrow(/closed fiscal year/);
  });

  it("allows an entry inside an open year", () => {
    expect(() => assertJournalEntryPeriodOpen(entry({ date: "2026-08-01" }), years)).not.toThrow();
  });

  it("allows an entry whose date falls outside every configured year", () => {
    // A workspace with no fiscal years (or a date beyond the configured range)
    // must stay postable rather than locking every write.
    expect(() => assertJournalEntryPeriodOpen(entry({ date: "2030-01-01" }), years)).not.toThrow();
    expect(() => assertJournalEntryPeriodOpen(entry({ date: "2020-01-01" }), [])).not.toThrow();
  });
});

describe("journalEntryContentChanged (IAS 21)", () => {
  const posted = (lines: JournalEntry["lines"]): JournalEntry =>
    ({ id: "je", date: "2026-10-01", status: "posted", lines }) as JournalEntry;
  const usd = (rate: string) => ({
    id: "l1",
    account_id: "ar",
    debit: 280000,
    credit: 0,
    description: "",
    txn_currency: "USD",
    txn_debit: "1000.00",
    txn_credit: "0.00",
    exchange_rate: rate,
  });

  it("given the same functional amount at a different rate, should report the entry as changed", () => {
    // Arrange
    const stored = posted([usd("280")]);
    const incoming = posted([{ ...usd("280"), txn_debit: "999.99", exchange_rate: "280.0028" }]);

    // Act
    const changed = journalEntryContentChanged(incoming, stored);

    // Assert
    expect(changed).toBe(true);
  });

  it("given a stored row written before the IAS 21 backfill, should compare functional amounts only", () => {
    // Arrange
    const stored = posted([
      { id: "l1", account_id: "ar", debit: 280000, credit: 0, description: "" },
    ]);

    // Act
    const changed = journalEntryContentChanged(posted([usd("280")]), stored);

    // Assert
    expect(changed).toBe(false);
  });
});
