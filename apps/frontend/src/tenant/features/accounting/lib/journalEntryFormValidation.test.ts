import { describe, expect, it } from "vitest";
import {
  journalLineAmountErrorKey,
  parseJournalLineAmount,
  validateJournalEntryForm,
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

  it("lets a parsed comma amount through validation on a comma workspace", () => {
    const draft = form("Entry");
    draft.lines = [line("1234,56"), { ...line("", "1234,56"), id: "l2", account_id: "fees" }];
    const errors = validateJournalEntryForm(draft, [], "draft", true, t, "comma");
    expect(errors.lineAmount0).toBeUndefined();
  });
});
