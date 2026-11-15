import { describe, expect, it } from "vitest";
import {
  journalLineAmountErrorKey,
  parseJournalLineAmount,
  validateJournalEntryForm,
  validateJournalPostingGuards,
} from "./journalEntryFormValidation";
import type { DraftForm, DraftLine } from "./journalEntryFormTypes";

const line = (debit: string, credit = ""): DraftLine => ({
  id: "l1",
  account_id: "cash",
  debit,
  credit,
  description: "",
});

const form = (description: string): DraftForm => ({
  id: "",
  date: "2026-11-14",
  ref: "",
  description,
  status: "draft",
  created_by: "u1",
  tags: [],
  attachments: [],
  fiscal_year: "2026",
  lines: [line("10", ""), { ...line("", "10"), id: "l2", account_id: "fees" }],
});

const t = ((key: string) => key) as never;

describe("parseJournalLineAmount", () => {
  it("reads the comma-decimal form on a comma workspace instead of stripping it", () => {
    // The old `replace(/,/g, "")` turned "1234,56" into 123456 — a 100x posting.
    expect(parseJournalLineAmount("1234,56", "comma")).toBe(1234.56);
    expect(parseJournalLineAmount("1.234,56", "comma")).toBe(1234.56);
    expect(parseJournalLineAmount("1,5", "comma")).toBe(1.5);
  });

  it("keeps period workspaces strict and refuses ambiguous/grouped comma input", () => {
    expect(parseJournalLineAmount("1234.56", "period")).toBe(1234.56);
    expect(parseJournalLineAmount("1,234.56", "period")).toBe(1234.56);
    expect(parseJournalLineAmount("1234,56", "period")).toBe(0);
    expect(parseJournalLineAmount("1,5", "period")).toBe(0);
  });

  it("refuses more than two decimals, exponents and non-numeric text", () => {
    expect(parseJournalLineAmount("12.345")).toBe(0);
    expect(parseJournalLineAmount("1e3")).toBe(0);
    expect(parseJournalLineAmount("abc")).toBe(0);
    expect(parseJournalLineAmount("")).toBe(0);
  });

  it("rejects negative, over-precision and unsafe-cent values against the money schema", () => {
    expect(journalLineAmountErrorKey("-1")).toBe("accounting.journal.form.errorAmountFormat");
    expect(journalLineAmountErrorKey("90071992547409.92")).toBe(
      "accounting.journal.form.errorAmountFormat",
    );
    expect(journalLineAmountErrorKey("1.005")).toBe("accounting.journal.form.errorAmountFormat");
  });

  it("reports a format error for the same inputs the parser refuses", () => {
    expect(journalLineAmountErrorKey("1234,56", "period")).toBe(
      "accounting.journal.form.errorAmountFormat",
    );
    expect(journalLineAmountErrorKey("12.345")).toBe("accounting.journal.form.errorAmountFormat");
    expect(journalLineAmountErrorKey("1234,56", "comma")).toBeNull();
  });
});

describe("validateJournalEntryForm", () => {
  it("requires narration and a balanced posted voucher", () => {
    const errors = validateJournalEntryForm(form(""), [], "posted", false, t);
    expect(errors.description).toBe("accounting.journal.form.errorNarration");
    expect(errors.balance).toBe("accounting.journal.form.errorBalance");
  });

  it("rejects a two-sided line on a posted voucher", () => {
    const draft = form("Entry");
    draft.lines = [line("10", "1"), { ...line("", "10"), id: "l2", account_id: "fees" }];
    const errors = validateJournalEntryForm(draft, [], "posted", false, t);
    expect(errors.lineAmount0).toBe("accounting.journal.form.errorSingleSided");
  });

  it("lets a parsed comma amount through validation on a comma workspace", () => {
    const draft = form("Entry");
    draft.lines = [line("1234,56"), { ...line("", "1234,56"), id: "l2", account_id: "fees" }];
    const errors = validateJournalEntryForm(draft, [], "draft", true, t, "comma");
    expect(errors.lineAmount0).toBeUndefined();
  });
});

describe("validateJournalPostingGuards", () => {
  const years = [
    {
      id: "fy-2026",
      label: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "closed" as const,
    },
  ];

  it("blocks a date in a closed fiscal year", () => {
    const errors = validateJournalPostingGuards(
      { ...form("Entry"), fiscal_year_id: "fy-2026" },
      { fiscalYears: years },
      t,
    );
    expect(errors.date).toBe("accounting.journal.form.errorClosedFiscalYear");
    expect(errors.fiscal_year_id).toBe("accounting.journal.form.errorClosedFiscalYear");
  });

  it("blocks a date in a closed posting period", () => {
    const errors = validateJournalPostingGuards(
      form("Entry"),
      {
        fiscalYears: [],
        postingPeriods: [
          {
            id: "p-1",
            fiscalYearId: "fy-2026",
            label: "Nov 2026",
            startDate: "2026-11-01",
            endDate: "2026-11-30",
            status: "closed",
          },
        ],
      },
      t,
    );
    expect(errors.date).toContain("errorClosedPostingPeriod");
  });

  it("requires a manual reference when automatic numbering is off", () => {
    const errors = validateJournalPostingGuards(
      form("Entry"),
      {
        fiscalYears: [],
        voucherAutoGenerate: false,
      },
      t,
    );
    expect(errors.ref).toBe("accounting.journal.form.refRequiredManual");
  });

  it("allows a date after the latest configured fiscal year and blocks a gap", () => {
    const openYears = [
      {
        id: "fy-2025",
        label: "2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "active" as const,
      },
      {
        id: "fy-2027",
        label: "2027",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        status: "active" as const,
      },
    ];
    const after = validateJournalPostingGuards(
      { ...form("Entry"), date: "2028-01-01" },
      { fiscalYears: openYears },
      t,
    );
    expect(after.date).toBeUndefined();
    const gap = validateJournalPostingGuards(
      { ...form("Entry"), date: "2026-06-01" },
      { fiscalYears: openYears },
      t,
    );
    expect(gap.date).toBe("accounting.journal.form.errorOutsideFiscalYear");
  });
});
