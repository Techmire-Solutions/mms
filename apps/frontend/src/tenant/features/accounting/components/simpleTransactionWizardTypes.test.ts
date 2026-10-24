import { describe, expect, it } from "vitest";
import type { Account } from "@/lib/data/accountingData";
import {
  TRANSACTION_GROUPS,
  buildWizardFormState,
  resolveSimpleTransactionAccounts,
  validateWizardForm,
  wizardAccountOptions,
  wizardCategoryAccountOptions,
  type WizardFormState,
} from "../lib/simpleTransactionWizardTypes";

const translate = (key: string) => `t:${key}`;

const seedChart: Account[] = [
  {
    id: "a1000",
    code: "1000",
    name: "Cash in Hand",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a1010",
    code: "1010",
    name: "Bank Account – HBL",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a4000",
    code: "4000",
    name: "Student Fee Income",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
  {
    id: "a5000",
    code: "5000",
    name: "Staff Salaries",
    type: "Expense",
    subtype: "Operating Expense",
    description: "",
    isActive: true,
  },
  {
    id: "a3000",
    code: "3000",
    name: "Opening Capital",
    type: "Equity",
    subtype: "Owner's Equity",
    description: "",
    isActive: true,
  },
];

/** A chart whose accounts were all created in the UI (generated ids, no seed ids). */
const generatedChart: Account[] = [
  {
    id: "a1f2e3d4-0000-4000-8000-000000000001",
    code: "1000",
    name: "Main Cash Box",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a1f2e3d4-0000-4000-8000-000000000002",
    code: "1010",
    name: "Meezan Current",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a1f2e3d4-0000-4000-8000-000000000003",
    code: "4000",
    name: "Tuition Income",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
  {
    id: "a1f2e3d4-0000-4000-8000-000000000004",
    code: "5000",
    name: "Wages",
    type: "Expense",
    subtype: "Operating Expense",
    description: "",
    isActive: true,
  },
];

const group = (groupKey: string) =>
  TRANSACTION_GROUPS.find((transactionGroup) => transactionGroup.groupKey === groupKey)!;
const moneyIn = group("accounting.journal.dashboard.group.moneyIn");
const moneyOut = group("accounting.journal.dashboard.group.moneyOut");
const transfers = group("accounting.journal.dashboard.group.transfers");
const feeCollection = moneyIn.items.find((item) => item.id === "fee_collection")!;
const salary = moneyOut.items.find((item) => item.id === "salary")!;
const donation = moneyIn.items.find((item) => item.id === "donation")!;
const transfer = transfers.items.find((item) => item.id === "transfer")!;
const adjustment = transfers.items.find((item) => item.id === "adjustment")!;

const form = (overrides: Partial<WizardFormState> = {}): WizardFormState => ({
  date: "2026-01-15",
  amount: "100",
  debitAcc: "a1000",
  creditAcc: "a4000",
  description: "Fee collection",
  ref: "",
  receipt: "",
  fiscal_year: "2026",
  ...overrides,
});

describe("validateWizardForm", () => {
  it("rejects an entry whose two legs are the same account", () => {
    const result = validateWizardForm(form({ debitAcc: "a1000", creditAcc: "a1000" }), seedChart);
    expect(result).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorSameAccount",
    });
  });

  it("rejects the same account even when both legs are otherwise valid accounts", () => {
    // The server cannot catch this: two equal single-sided legs are "balanced"
    // and would post as a permanent no-op.
    const result = validateWizardForm(form({ debitAcc: "a1010", creditAcc: "a1010" }), seedChart);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errorKey).toBe(
      "accounting.journal.dashboard.wizard.errorSameAccount",
    );
  });

  it("accepts two different active accounts with a parseable amount", () => {
    const result = validateWizardForm(form({ amount: "12,50" }), seedChart);
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.amount).toBe(12.5);
    expect(result.ok === true && result.debitAccount.id).toBe("a1000");
    expect(result.ok === true && result.creditAccount.id).toBe("a4000");
  });

  it("rejects an empty, unparseable or non-positive amount", () => {
    expect(validateWizardForm(form({ amount: "" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorAmount",
    });
    for (const amount of ["abc", "12.345", "-5", "1,234", "12,50 kg"]) {
      expect(validateWizardForm(form({ amount }), seedChart)).toEqual({
        ok: false,
        errorKey: "accounting.journal.dashboard.wizard.errorAmountInvalid",
      });
    }
    expect(validateWizardForm(form({ amount: "0" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorAmountInvalid",
    });
  });

  it("rejects unknown, archived or soft-deleted accounts instead of posting an id the server refuses", () => {
    expect(validateWizardForm(form({ creditAcc: "a9999" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorSource",
    });
    expect(validateWizardForm(form({ creditAcc: "" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorSource",
    });
    const archivedChart = seedChart.map((account) =>
      account.id === "a4000" ? { ...account, isActive: false } : account,
    );
    expect(validateWizardForm(form(), archivedChart).ok).toBe(false);
    const deletedChart = seedChart.map((account) =>
      account.id === "a4000" ? { ...account, deletedAt: "2026-01-01T00:00:00.000Z" } : account,
    );
    expect(validateWizardForm(form(), deletedChart).ok).toBe(false);
  });

  it("requires a date", () => {
    expect(validateWizardForm(form({ date: "" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorDate",
    });
  });
});

describe("resolveSimpleTransactionAccounts", () => {
  it("never leaves the Adjustment action on one account for both legs", () => {
    expect(adjustment.debitAcc).not.toBe(adjustment.creditAcc);
    const resolved = resolveSimpleTransactionAccounts(adjustment, seedChart);
    expect(resolved.debitAcc).toBe("a1000");
    // No preset counter-account: the user must choose one.
    expect(resolved.creditAcc).toBe("");
    expect(validateWizardForm(form({ ...resolved, amount: "50" }), seedChart)).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorSource",
    });
    // …and choosing the very same account again is refused.
    expect(
      validateWizardForm(
        form({ debitAcc: resolved.debitAcc, creditAcc: resolved.debitAcc }),
        seedChart,
      ),
    ).toEqual({
      ok: false,
      errorKey: "accounting.journal.dashboard.wizard.errorSameAccount",
    });
  });

  it("replaces seed prefill ids that are absent from a chart created in the UI", () => {
    const resolved = resolveSimpleTransactionAccounts(feeCollection, generatedChart);
    const availableIds = new Set(generatedChart.map((account) => account.id));
    expect(availableIds.has(resolved.debitAcc)).toBe(true);
    expect(availableIds.has(resolved.creditAcc)).toBe(true);
    expect(resolved.debitAcc).toBe("a1f2e3d4-0000-4000-8000-000000000001");
    // The income leg prefers a Revenue account over any other candidate.
    expect(resolved.creditAcc).toBe("a1f2e3d4-0000-4000-8000-000000000003");
    expect(resolved.debitAcc).not.toBe(resolved.creditAcc);
    expect(validateWizardForm(form({ ...resolved, amount: "1,234.56" }), generatedChart).ok).toBe(
      true,
    );
  });

  it("keeps a prefill id that does exist and prefers an expense counter-account for money out", () => {
    const resolved = resolveSimpleTransactionAccounts(salary, seedChart);
    expect(resolved.debitAcc).toBe("a5000");
    expect(resolved.creditAcc).toBe("a1010");
  });

  it("replaces archived prefill ids on a transfer", () => {
    const archivedChart = seedChart.map((account) =>
      account.id === "a1010" ? { ...account, isActive: false } : account,
    );
    const resolved = resolveSimpleTransactionAccounts(transfer, archivedChart);
    // "a1020" is absent from this chart and "a1010" is archived, so both legs
    // fall back to a live option (or to nothing when no second cash leg exists).
    expect(resolved.debitAcc).toBe("a1000");
    expect(resolved.creditAcc).toBe("");
    expect(validateWizardForm(form(resolved), archivedChart).ok).toBe(false);
  });

  it("keeps the two transfer legs different", () => {
    const sameLegTransfer = resolveSimpleTransactionAccounts(
      { ...transfer, debitAcc: "a1000", creditAcc: "a1000" },
      seedChart,
    );
    expect(sameLegTransfer.creditAcc).not.toBe(sameLegTransfer.debitAcc);
    expect(sameLegTransfer.creditAcc).toBe("a1010");
  });
});

describe("wizardAccountOptions", () => {
  it("derives options from the live chart, assets first with code and name", () => {
    const options = wizardAccountOptions(generatedChart);
    expect(options.map((option) => option.value)).toEqual([
      "a1f2e3d4-0000-4000-8000-000000000001",
      "a1f2e3d4-0000-4000-8000-000000000002",
    ]);
    expect(options.map((option) => option.label)).toEqual([
      "1000 — Main Cash Box",
      "1010 — Meezan Current",
    ]);
  });

  it("skips archived accounts and falls back to every account when a chart has no assets", () => {
    const archived = generatedChart.map((account) =>
      account.id === "a1f2e3d4-0000-4000-8000-000000000001"
        ? { ...account, isActive: false }
        : account,
    );
    expect(wizardAccountOptions(archived).map((option) => option.value)).toEqual([
      "a1f2e3d4-0000-4000-8000-000000000002",
    ]);

    const noAssets = generatedChart.filter((account) => account.type !== "Asset");
    expect(wizardAccountOptions(noAssets).map((option) => option.value)).toEqual([
      "a1f2e3d4-0000-4000-8000-000000000003",
      "a1f2e3d4-0000-4000-8000-000000000004",
    ]);
  });
});

describe("wizardCategoryAccountOptions", () => {
  it("filters accounts by category type", () => {
    const revenueOptions = wizardCategoryAccountOptions(generatedChart, "Revenue");
    expect(revenueOptions).toEqual([
      { value: "a1f2e3d4-0000-4000-8000-000000000003", label: "4000 — Tuition Income" },
    ]);

    const expenseOptions = wizardCategoryAccountOptions(generatedChart, "Expense");
    expect(expenseOptions).toEqual([
      { value: "a1f2e3d4-0000-4000-8000-000000000004", label: "5000 — Wages" },
    ]);
  });
});

describe("buildWizardFormState", () => {
  it("returns a fresh, empty form so a previous transaction cannot be reposted", () => {
    const first = buildWizardFormState(
      feeCollection,
      seedChart,
      { date: "2026-02-01", fiscalYearLabel: "2026" },
      translate,
    );
    expect(first.amount).toBe("");
    expect(first.ref).toBe("");
    expect(first.receipt).toBe("");
    expect(first.date).toBe("2026-02-01");
    expect(first.fiscal_year).toBe("2026");
    expect(first.debitAcc).toBe("a1000");
    expect(first.creditAcc).toBe("a4000");
    expect(first.description).toBe("t:accounting.journal.dashboard.desc.feeCollection");

    const second = buildWizardFormState(
      donation,
      seedChart,
      { date: "2026-02-02", fiscalYearLabel: "2026" },
      translate,
    );
    expect(second.description).toBe("t:accounting.journal.dashboard.desc.donationReceived");
    // Seed id "a4100" is not in this chart, so the income leg falls back to the
    // live Revenue account instead of an id the server would reject.
    expect(
      seedChart.some((account) => account.id === second.creditAcc && account.type === "Revenue"),
    ).toBe(true);
    expect(second.amount).toBe("");
  });

  it("applies a prefill that exists only in the live chart on every call", () => {
    const first = buildWizardFormState(
      feeCollection,
      generatedChart,
      { date: "2026-02-01", fiscalYearLabel: "2026" },
      translate,
    );
    const second = buildWizardFormState(
      feeCollection,
      generatedChart,
      { date: "2026-02-01", fiscalYearLabel: "2026" },
      translate,
    );
    expect(first).toEqual(second);
    expect(validateWizardForm({ ...first, amount: "99.99" }, generatedChart).ok).toBe(true);
  });

  it("builds a blank form with two distinct legs and no description", () => {
    const blank = buildWizardFormState(
      null,
      seedChart,
      { date: "2026-02-01", fiscalYearLabel: "2026" },
      translate,
    );
    expect(blank.description).toBe("");
    expect(blank.debitAcc).toBe("a1000");
    expect(blank.creditAcc).toBe("a1010");
    expect(blank.amount).toBe("");
  });
});

describe("calculateAccountBalanceCents and balance formatted labels", () => {
  it("formats live balances into wizardAccountOptions labels when entries and formatCurrency are provided", () => {
    const mockEntries = [
      {
        status: "posted",
        lines: [
          { account_id: "a1000", debit: 500, credit: 100 },
          { account_id: "a4000", debit: 0, credit: 400 },
        ],
      },
    ];
    const formatCurrency = (amt: number) => `$${amt.toFixed(2)}`;
    const options = wizardAccountOptions(seedChart, mockEntries, formatCurrency);
    const cashOption = options.find((opt) => opt.value === "a1000");
    expect(cashOption?.label).toBe("1000 — Cash in Hand ($400.00)");
  });

  it("classifies supplies and other_expense as Expense, and rental/other income as Income", () => {
    const supplies = moneyOut.items.find((item) => item.id === "supplies")!;
    const otherExpense = moneyOut.items.find((item) => item.id === "other_expense")!;
    const rentIncome = moneyIn.items.find((item) => item.id === "rent_income")!;
    const otherIncome = moneyIn.items.find((item) => item.id === "other_income")!;

    expect(supplies.tag).toBe("Expense");
    expect(otherExpense.tag).toBe("Expense");
    expect(rentIncome.tag).toBe("Income");
    expect(otherIncome.tag).toBe("Income");
  });
});
