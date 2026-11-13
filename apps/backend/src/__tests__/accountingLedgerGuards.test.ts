import { describe, expect, it } from "vitest";
import type { FiscalYear, JournalEntry } from "@mms/shared";
import {
  assertJournalAccountsWritable,
  assertJournalEntryPeriodOpen,
  prepareJournalEntryForPersist,
  journalEntryContentChanged,
  withServerOwnedSourceKeys,
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

  it("allows a forward date beyond the configured range", () => {
    // The next year not being created yet must not block an invoice due next month.
    expect(() => assertJournalEntryPeriodOpen(entry({ date: "2030-01-01" }), years)).not.toThrow();
  });

  it("allows any date when no fiscal year exists yet (bootstrap)", () => {
    expect(() => assertJournalEntryPeriodOpen(entry({ date: "2020-01-01" }), [])).not.toThrow();
  });

  it("rejects a date before the configured calendar", () => {
    // Backdating before the first fiscal year escaped every closed-year check
    // while still moving the books.
    expect(() =>
      assertJournalEntryPeriodOpen(entry({ date: "2020-01-01", fiscal_year: "" }), years),
    ).toThrow(/outside every configured fiscal year/);
  });

  it("rejects a date that falls in a gap between configured years", () => {
    const withGap: FiscalYear[] = [
      { ...years[0]!, startDate: "2026-07-01", endDate: "2027-06-30" },
      { ...years[1]!, startDate: "2024-07-01", endDate: "2025-06-30" },
    ];
    expect(() =>
      assertJournalEntryPeriodOpen(entry({ date: "2026-01-01", fiscal_year: "" }), withGap),
    ).toThrow(/outside every configured fiscal year/);
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

describe("ledger amount fits numeric(14,2)", () => {
  it("rejects an amount the column cannot store as a 422, not a driver overflow", () => {
    // 1e12 is one cent past `numeric(14,2)` (max 999,999,999,999.99). The shared DTO
    // accepts it (safe integer cents), so this is the layer that has to say no.
    const tooLarge = entry({
      lines: [
        { id: "l1", account_id: "a1", debit: 1_000_000_000_000, credit: 0, description: "" },
        { id: "l2", account_id: "a2", debit: 0, credit: 1_000_000_000_000, description: "" },
      ],
    });
    expect(() => prepareJournalEntryForPersist(tooLarge, years)).toThrowError(
      /two-decimal ledger maximum/,
    );
    try {
      prepareJournalEntryForPersist(tooLarge, years);
    } catch (error) {
      expect((error as { statusCode?: number }).statusCode).toBe(422);
    }
  });

  it("accepts the largest storable amount", () => {
    const atLimit = entry({
      lines: [
        { id: "l1", account_id: "a1", debit: 999_999_999_999.99, credit: 0, description: "" },
        { id: "l2", account_id: "a2", debit: 0, credit: 999_999_999_999.99, description: "" },
      ],
    });
    expect(() => prepareJournalEntryForPersist(atLimit, years)).not.toThrow();
  });
});

describe("transaction-currency double entry", () => {
  const line = (txn_currency: string, txn_debit: string, txn_credit: string) => ({
    txn_currency,
    txn_debit,
    txn_credit,
  });

  it("rejects a single-currency voucher whose document legs do not balance", () => {
    // The functional totals net out (the entry "balances" in PKR) while the USD
    // document is short by 80 — the shape that used to pass silently.
    const imbalanced = entry({
      lines: [
        {
          id: "l1",
          account_id: "a1",
          debit: 28000,
          credit: 0,
          description: "",
          ...line("USD", "100.00", "0.00"),
        },
        {
          id: "l2",
          account_id: "a2",
          debit: 0,
          credit: 20000,
          description: "",
          ...line("USD", "0.00", "100.00"),
        },
        {
          id: "l3",
          account_id: "a3",
          debit: 0,
          credit: 8000,
          description: "",
          ...line("USD", "0.00", "80.00"),
        },
      ],
    });

    expect(() => prepareJournalEntryForPersist(imbalanced, years)).toThrowError(
      /does not balance in its transaction currency: USD/,
    );
  });

  it("accepts a balanced foreign voucher", () => {
    const balanced = entry({
      lines: [
        {
          id: "l1",
          account_id: "a1",
          debit: 28000,
          credit: 0,
          description: "",
          ...line("USD", "100.00", "0.00"),
        },
        {
          id: "l2",
          account_id: "a2",
          debit: 0,
          credit: 28000,
          description: "",
          ...line("USD", "0.00", "100.00"),
        },
      ],
    });

    expect(() => prepareJournalEntryForPersist(balanced, years)).not.toThrow();
  });

  it("accepts a mixed-currency settlement voucher (legs differ by design)", () => {
    // Retire a USD receivable against PKR cash and book the realised gain: the USD and
    // PKR legs are not per-currency balanced, and they must not be required to be.
    const settlement = entry({
      lines: [
        {
          id: "l1",
          account_id: "a1",
          debit: 0,
          credit: 28000,
          description: "",
          ...line("USD", "0.00", "1000.00"),
        },
        {
          id: "l2",
          account_id: "a2",
          debit: 28500,
          credit: 0,
          description: "",
          ...line("PKR", "28500.00", "0.00"),
        },
        {
          id: "l3",
          account_id: "a3",
          debit: 0,
          credit: 500,
          description: "",
          ...line("PKR", "0.00", "500.00"),
        },
      ],
    });

    expect(() => prepareJournalEntryForPersist(settlement, years)).not.toThrow();
  });

  it("leaves an unbalanced draft alone (drafts are not in the ledger yet)", () => {
    const draft = entry({
      status: "draft",
      lines: [
        {
          id: "l1",
          account_id: "a1",
          debit: 100,
          credit: 0,
          description: "",
          ...line("USD", "100.00", "0.00"),
        },
      ],
    });

    expect(() => prepareJournalEntryForPersist(draft, years)).not.toThrow();
  });
});

describe("account postability", () => {
  const lines = (accountId: string) => [
    { id: "l1", account_id: accountId, debit: 10, credit: 0, description: "" },
    { id: "l2", account_id: "a2", debit: 0, credit: 10, description: "" },
  ];

  it("rejects a header/summary account (one that has sub-accounts)", async () => {
    await expect(
      assertJournalAccountsWritable("t-1", [entry({ lines: lines("parent") })], async () => [
        { id: "parent", isActive: true, hasChildren: true },
        { id: "a2", isActive: true, hasChildren: false },
      ]),
    ).rejects.toThrow(/parent \(summary account with sub-accounts\)/);
  });

  it("accepts a leaf account and reports every unpostable id at once", async () => {
    await expect(
      assertJournalAccountsWritable("t-1", [entry({ lines: lines("leaf") })], async () => [
        { id: "leaf", isActive: true, hasChildren: false },
        { id: "a2", isActive: true, hasChildren: false },
      ]),
    ).resolves.toBeUndefined();

    await expect(
      assertJournalAccountsWritable("t-1", [entry({ lines: lines("gone") })], async () => []),
    ).rejects.toThrow(/gone \(unknown or archived\)/);
  });
});

describe("account currency restriction (every posting path)", () => {
  const accounts = [
    { id: "pkr-only", isActive: true, hasChildren: false, accountCurrency: "PKR" },
    { id: "usd-bank", isActive: true, hasChildren: false, accountCurrency: "USD" },
    { id: "any", isActive: true, hasChildren: false, accountCurrency: null },
  ];
  const line = (accountId: string, txn_currency?: string) => ({
    id: `l-${accountId}`,
    account_id: accountId,
    debit: 10,
    credit: 0,
    description: "",
    ...(txn_currency ? { txn_currency } : {}),
  });
  const posted = (...lines: ReturnType<typeof line>[]) => entry({ lines });

  it("rejects a foreign line on an account locked to another currency", async () => {
    // The manual resolver caught this; generated postings (invoices, payments,
    // openings) never ran it, so the guard has to check the line itself.
    await expect(
      assertJournalAccountsWritable("t-1", [posted(line("pkr-only", "USD"))], async () => accounts),
    ).rejects.toThrow(/pkr-only \(only accepts PKR lines, got USD\)/);
  });

  it("accepts a line in the account's currency and an unlocked account", async () => {
    await expect(
      assertJournalAccountsWritable(
        "t-1",
        [posted(line("usd-bank", "USD"), line("any", "EUR"))],
        async () => accounts,
      ),
    ).resolves.toBeUndefined();
  });

  it("does not judge a line that carries no transaction currency", async () => {
    // The resolver treats it as functional; the guard cannot tell, so it stays out.
    await expect(
      assertJournalAccountsWritable("t-1", [posted(line("pkr-only"))], async () => accounts),
    ).resolves.toBeUndefined();
  });
});

describe("server-owned attribution", () => {
  it("keeps the stored preparer when an edit resends a different one", () => {
    const stored = entry({ created_by: "original" });
    const incoming = entry({ created_by: "someone-else" });
    expect(withServerOwnedSourceKeys(incoming, stored).created_by).toBe("original");
    // A brand-new entry keeps the preparer the caller supplied.
    expect(withServerOwnedSourceKeys(incoming, undefined).created_by).toBe("someone-else");
  });
});
