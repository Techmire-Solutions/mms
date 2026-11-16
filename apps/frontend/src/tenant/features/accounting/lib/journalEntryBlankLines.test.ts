import { describe, expect, it } from "vitest";
import { buildJournalEntrySaveCandidate } from "./journalEntrySaveCandidate";
import { validateJournalEntryForm } from "./journalEntryFormValidation";
import type { DraftForm, DraftLine } from "./journalEntryFormTypes";

/**
 * The voucher editor always renders one pristine placeholder row. It used to fail
 * line validation ("Account required") and reach the API as an empty account leg,
 * so a perfectly complete two-line voucher could not be saved.
 */

const t = ((key: string) => key) as never;

const line = (overrides: Partial<DraftLine>): DraftLine => ({
  id: "l1",
  account_id: "cash",
  debit: "",
  credit: "",
  description: "",
  ...overrides,
});

const BLANK_LINE = line({ id: "l3", account_id: "", debit: "", credit: "" });

const draft: DraftForm = {
  id: "",
  date: "2026-11-14",
  ref: "",
  description: "Office supplies",
  status: "draft",
  created_by: "u1",
  tags: [],
  attachments: [],
  fiscal_year: "2026",
  lines: [
    line({ id: "l1", account_id: "office", debit: "10" }),
    line({ id: "l2", account_id: "cash", credit: "10" }),
    BLANK_LINE,
  ],
};

describe("blank journal lines", () => {
  it("two complete lines plus a blank row pass validation", () => {
    const errors = validateJournalEntryForm(draft, [], "posted", true, t);

    expect(errors.lines).toBeUndefined();
    expect(errors.line0).toBeUndefined();
    expect(errors.line1).toBeUndefined();
    expect(errors.line2).toBeUndefined();
  });

  it("drops the blank row from the save candidate", () => {
    const candidate = buildJournalEntrySaveCandidate({
      form: draft,
      targetStatus: "posted",
      decimalSeparator: "period",
      fx: { currency: "PKR", functionalCurrency: "PKR", rate: "", isForeign: false },
      isEdit: false,
    });

    expect(candidate.lines).toHaveLength(2);
    expect(candidate.lines.map((journalLine) => journalLine.account_id)).toEqual([
      "office",
      "cash",
    ]);
  });

  it("still reports a partially filled row that has an amount but no account", () => {
    const partiallyFilled: DraftForm = {
      ...draft,
      lines: [
        line({ id: "l1", account_id: "office", debit: "10" }),
        line({ id: "l2", account_id: "cash", credit: "10" }),
        line({ id: "l3", account_id: "", debit: "10", credit: "" }),
      ],
    };

    const errors = validateJournalEntryForm(partiallyFilled, [], "posted", true, t);
    expect(errors.line2).toBe("accounting.journal.form.errorAccountRequired");
  });
});
