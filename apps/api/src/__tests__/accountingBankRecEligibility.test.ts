import { describe, expect, it } from "vitest";
import { bankReconciliationMatchError } from "@mms/mod-accounting/backend/repository";

describe("bankReconciliationMatchError", () => {
  const base = {
    statementLineExists: true,
    statementAccountId: "bank-1",
    entryStatus: "posted",
    journalLineAccountId: "bank-1",
  };

  it("accepts a posted line on the statement's own bank account", () => {
    expect(bankReconciliationMatchError(base)).toBeNull();
  });

  it("rejects a match to a statement line that does not exist", () => {
    expect(bankReconciliationMatchError({ ...base, statementLineExists: false })).toBe(
      "bank_line_not_found",
    );
  });

  it("rejects a match to a draft journal entry", () => {
    expect(bankReconciliationMatchError({ ...base, entryStatus: "draft" })).toBe(
      "entry_not_posted",
    );
    expect(bankReconciliationMatchError({ ...base, entryStatus: null })).toBe("entry_not_posted");
  });

  it("rejects a match to a journal line on a different bank account", () => {
    expect(bankReconciliationMatchError({ ...base, journalLineAccountId: "bank-2" })).toBe(
      "account_mismatch",
    );
  });

  it("rejects a missing journal line", () => {
    expect(bankReconciliationMatchError({ ...base, journalLineAccountId: null })).toBe(
      "journal_line_not_found",
    );
  });
});
