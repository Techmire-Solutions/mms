import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StepTransactionForm } from "./SimpleTransactionStepForm";
import type { WizardFormState } from "./simpleTransactionWizardTypes";
import type { Account, JournalEntry } from "@/lib/data/accountingData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/accounting/hooks/useVoucherNumbering", () => ({
  useVoucherNumbering: () => ({ data: { autoGenerate: true, nextVoucherNumber: "JE-0001" } }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (val: string) => void;
  }) => (
    <input
      data-testid={id || "datepicker"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/FormSelect", () => ({
  FormSelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (val: string) => void;
  }) => <input id={id} data-testid={id} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { QUICK_ACTIONS } from "./journalEntriesQuickActions";

const mockActionType = QUICK_ACTIONS[0]!.type;

const mockAccounts: Account[] = [
  {
    id: "a1000",
    code: "1000",
    name: "Cash on Hand",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a4000",
    code: "4000",
    name: "Fee Income",
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
];

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("StepTransactionForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders wizard amount input with inputMode=decimal and displays currency symbol", async () => {
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "250.00",
      description: "Tuition fee payment",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "REF-001",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          currencySymbol="$"
        />,
      );
    });

    const amountInput = container.querySelector("#wizard-amount") as HTMLInputElement;
    expect(amountInput).not.toBeNull();
    expect(amountInput.getAttribute("inputmode")).toBe("decimal");
    expect(amountInput.value).toBe("250.00");
    expect(container.textContent).toContain("$");

    const currencySpan = amountInput.parentElement?.querySelector("span");
    expect(currencySpan?.className).toContain("pointer-events-none");
  });

  it("triggers setForm callback when amount is updated", async () => {
    const setForm = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "",
      description: "",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={setForm}
          accounts={mockAccounts}
          currencySymbol="$"
        />,
      );
    });

    const amountInput = container.querySelector("#wizard-amount") as HTMLInputElement;
    expect(container.textContent).not.toContain("accounting.journal.dashboard.wizard.errorAmount");

    await act(async () => {
      setInputValue(amountInput, "300.50");
    });

    expect(setForm).toHaveBeenCalled();

    await act(async () => {
      setInputValue(amountInput, "");
    });

    expect(container.textContent).toContain("accounting.journal.dashboard.wizard.errorAmount");
  });

  it("renders both receivedInto and incomeCategory selectors for moneyIn transactions", async () => {
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100.00",
      description: "Fee",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          currencySymbol="$"
        />,
      );
    });

    expect(container.querySelector("#wizard-acc-in")).not.toBeNull();
    expect(container.querySelector("#wizard-acc-category-in")).not.toBeNull();
  });

  it("renders both paidFrom and expenseCategory selectors for moneyOut transactions", async () => {
    const salaryActionType = QUICK_ACTIONS.find(
      (action) => action.type.groupKey === "accounting.journal.dashboard.group.moneyOut",
    )!.type;
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "500.00",
      description: "Staff Salary",
      debitAcc: "a5000",
      creditAcc: "a1000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={salaryActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          currencySymbol="$"
        />,
      );
    });

    expect(container.querySelector("#wizard-acc-out")).not.toBeNull();
    expect(container.querySelector("#wizard-acc-category-out")).not.toBeNull();
  });

  it("renders financial year select and tag controls", async () => {
    const setForm = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100.00",
      description: "Fee",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "REF-001",
      receipt: "",
      fiscal_year: "2026",
      tags: ["Fees", "CustomTag"],
    };
    const fiscalYears = [
      {
        id: "fy-2025",
        label: "2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "closed" as const,
      },
      {
        id: "fy-2026",
        label: "2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active" as const,
      },
    ];

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={setForm}
          accounts={mockAccounts}
          currencySymbol="$"
          fiscalYears={fiscalYears}
        />,
      );
    });

    expect(container.querySelector("#wizard-fiscal-year")).not.toBeNull();
    expect(container.querySelector("#wizard-ref")).not.toBeNull();
    expect(container.querySelector("#wizard-custom-tag")).not.toBeNull();
    expect(container.textContent).toContain("CustomTag");
  });

  it("hides financial year select when there is only one fiscal year (D3)", async () => {
    const setForm = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100.00",
      description: "Sample",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };
    const singleFiscalYear = [
      {
        id: "fy-2026",
        label: "2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active" as const,
      },
    ];

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={setForm}
          accounts={mockAccounts}
          currencySymbol="$"
          fiscalYears={singleFiscalYear}
        />,
      );
    });

    expect(container.querySelector("#wizard-fiscal-year")).toBeNull();
  });

  it("triggers onProceed when Enter is pressed on description input", async () => {
    const onProceed = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100.00",
      description: "Sample Description",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          currencySymbol="$"
          onProceed={onProceed}
        />,
      );
    });

    const descInput = container.querySelector("#wizard-description") as HTMLInputElement;
    expect(descInput).not.toBeNull();
    await act(async () => {
      descInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it("renders Change Type button and triggers onChangeType", async () => {
    const onChangeType = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100.00",
      description: "Sample",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          currencySymbol="$"
          onChangeType={onChangeType}
        />,
      );
    });

    const changeTypeBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("accounting.journal.dashboard.wizard.changeType"),
    );
    expect(changeTypeBtn).not.toBeUndefined();
    await act(async () => {
      changeTypeBtn?.click();
    });
    expect(onChangeType).toHaveBeenCalledTimes(1);
  });

  it("adds increment to amount when a denomination chip is clicked", async () => {
    const setForm = vi.fn();
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100",
      description: "Sample",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={setForm}
          accounts={mockAccounts}
          currencySymbol="$"
        />,
      );
    });

    const chip500 = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("+500"),
    );
    expect(chip500).not.toBeUndefined();
    await act(async () => {
      chip500?.click();
    });
    expect(setForm).toHaveBeenCalled();
  });

  it("displays duplicate reference warning when entered ref collides with an existing entry", async () => {
    const existingEntry: JournalEntry = {
      id: "je-1",
      ref: "JE-0001",
      date: "2026-09-01",
      description: "Existing entry",
      status: "posted",
      created_by: "system",
      fiscal_year: "2026",
      tags: [],
      attachments: [],
      lines: [],
    };
    const formState: WizardFormState = {
      date: "2026-09-01",
      amount: "100",
      description: "Sample",
      debitAcc: "a1000",
      creditAcc: "a4000",
      ref: "JE-0001",
      receipt: "",
      fiscal_year: "2026",
    };

    await act(async () => {
      root.render(
        <StepTransactionForm
          type={mockActionType}
          form={formState}
          setForm={vi.fn()}
          accounts={mockAccounts}
          entries={[existingEntry]}
          currencySymbol="$"
        />,
      );
    });

    const errorEl = container.querySelector("#wizard-ref-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain("accounting.journal.dashboard.wizard.errorRefDuplicate");
  });
});
