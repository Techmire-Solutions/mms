import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { journalEntryRecordSchema, type JournalEntry } from "@mms/shared";
import type { JournalEntrySave } from "./journalEntriesTypes";
import { SimpleTransactionWizard } from "./SimpleTransactionWizard";
import { StepReview } from "./SimpleTransactionStepReview";
import { TRANSACTION_GROUPS } from "./simpleTransactionWizardTypes";
import type { Account } from "@/lib/data/accountingData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const journalTemplatesMock = vi.hoisted(() => ({
  templates: [] as import("@mms/shared").JournalTemplate[],
}));

vi.mock("@/tenant/features/accounting/hooks/useJournalTemplates", () => ({
  useJournalTemplates: () => ({
    templates: journalTemplatesMock.templates,
    canSeed: false,
    seeding: false,
    seedTemplates: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useVoucherNumbering", () => ({
  useVoucherNumbering: () => ({ data: { autoGenerate: true, nextVoucherNumber: "JE-0001" } }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Amina Accountant" } }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    activeCurrency: { symbol: "$", code: "USD" },
    formatCurrency: (amount: number | string | null | undefined) => `$${amount ?? "—"}`,
  }),
}));

vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({ id, value, onChange }: any) => (
    <input
      data-testid={id || "datepicker"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

/** The real modal keeps the wizard mounted between openings; only its portal unmounts. */
vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({ open, headerExtra, children }: any) =>
    open ? (
      <div data-testid="wizard-modal">
        {headerExtra}
        {children}
      </div>
    ) : null,
}));

import { notify } from "@/lib/notify";

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    archivedWithUndo: vi.fn(),
  },
}));

const group = (groupKey: string) =>
  TRANSACTION_GROUPS.find((transactionGroup) => transactionGroup.groupKey === groupKey)!;
const feeCollection = group("accounting.journal.dashboard.group.moneyIn").items.find(
  (item) => item.id === "fee_collection",
)!;
const adjustment = group("accounting.journal.dashboard.group.transfers").items.find(
  (item) => item.id === "adjustment",
)!;

const seedAccounts: Account[] = [
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
];

const fiscalYears = [
  {
    id: "fy-2026",
    label: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active" as const,
  },
];

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectOption(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButton(container: HTMLElement, textFragment: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(textFragment),
  );
  if (!button) throw new Error(`No button containing "${textFragment}"`);
  return button as HTMLButtonElement;
}

describe("SimpleTransactionWizard", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSave: Mock<JournalEntrySave>;
  let onClose: Mock<() => void>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSave = vi.fn();
    onClose = vi.fn();
    (notify.error as Mock).mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const renderWizard = async (
    open: boolean,
    prefillType: typeof feeCollection | typeof adjustment | null = null,
    accounts: Account[] = seedAccounts,
  ) => {
    await act(async () => {
      root.render(
        <SimpleTransactionWizard
          open={open}
          accounts={accounts}
          entries={[]}
          fiscalYears={fiscalYears}
          prefillType={prefillType}
          onSave={onSave}
          onClose={onClose}
        />,
      );
    });
  };

  const amountInput = () => container.querySelector("#wizard-amount") as HTMLInputElement;

  it("posts the parsed comma-decimal amount instead of the parseFloat truncation", async () => {
    await renderWizard(true, feeCollection);
    expect(amountInput()).not.toBeNull();

    await act(async () => {
      setInputValue(amountInput(), "12,50");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    expect(container.textContent).toContain("$12.5");
    expect(container.textContent).not.toContain("$12 ");

    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const posted = onSave.mock.calls[0]![0];
    expect(posted.lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1000", 12.5, 0],
      ["a4000", 0, 12.5],
    ]);
    expect(posted.status).toBe("posted");
    expect(posted.created_by).toBe("Amina Accountant");
    // Nothing the shared contract would reject may reach the append-only ledger.
    expect(journalEntryRecordSchema.safeParse(posted).success).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("blocked an unparseable amount instead of posting a truncated one", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "12.345");
    });
    const nextButton = findButton(container, "accounting.journal.dashboard.wizard.next");
    expect(nextButton.disabled).toBe(true);
    expect(container.textContent).toContain(
      "accounting.journal.dashboard.wizard.errorAmountInvalid",
    );
  });

  it("starts every opening from a clean form so the previous transaction cannot be reposted", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "99.99");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    // The dialog closes (its parent sets simpleModal to null) and reopens with
    // another quick action.
    await renderWizard(false, feeCollection);
    await renderWizard(true, feeCollection);

    expect(amountInput().value).toBe("");
    expect((container.querySelector("#wizard-description") as HTMLInputElement).value).toBe(
      "accounting.journal.dashboard.desc.feeCollection",
    );
    expect(container.textContent).not.toContain(
      "accounting.journal.dashboard.wizard.postTransaction",
    );
    expect((container.querySelector("#wizard-acc-in") as HTMLSelectElement).value).toBe("a1000");
  });

  it("refuses to post the same account on both legs", async () => {
    await renderWizard(true, adjustment);
    // The Adjustment action presets a source account and leaves the
    // counter-account for the user.
    expect((container.querySelector("#wizard-acc-to") as HTMLSelectElement).value).toBe("a1000");
    expect((container.querySelector("#wizard-acc-from") as HTMLSelectElement).value).toBe("");

    await act(async () => {
      setInputValue(amountInput(), "50");
    });
    await act(async () => {
      selectOption(container.querySelector("#wizard-acc-from") as HTMLSelectElement, "a1000");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(
      "accounting.journal.dashboard.wizard.errorSameAccount",
    );
  });

  it("posts an adjustment once a real counter-account is chosen", async () => {
    await renderWizard(true, adjustment);
    await act(async () => {
      setInputValue(amountInput(), "50.25");
    });
    await act(async () => {
      selectOption(container.querySelector("#wizard-acc-from") as HTMLSelectElement, "a1010");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });

    expect(notify.error).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
    const posted = onSave.mock.calls[0]![0];
    expect(posted.lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1000", 50.25, 0],
      ["a1010", 0, 50.25],
    ]);
    expect(journalEntryRecordSchema.safeParse(posted).success).toBe(true);
  });

  it("does not offer seed cash ids that the live chart does not have", async () => {
    const generatedAccounts: Account[] = [
      {
        id: "a11111111-1111-4111-8111-111111111111",
        code: "1000",
        name: "Main Cash Box",
        type: "Asset",
        subtype: "Current Asset",
        description: "",
        isActive: true,
      },
      {
        id: "a22222222-2222-4222-8222-222222222222",
        code: "4000",
        name: "Tuition Income",
        type: "Revenue",
        subtype: "Operating Revenue",
        description: "",
        isActive: true,
      },
    ];
    await renderWizard(true, feeCollection, generatedAccounts);

    const cashSelect = container.querySelector("#wizard-acc-in") as HTMLSelectElement;
    expect(cashSelect.value).toBe("a11111111-1111-4111-8111-111111111111");
    const optionValues = Array.from(cashSelect.options).map((option) => option.value);
    expect(optionValues).not.toContain("a1000");

    await act(async () => {
      setInputValue(amountInput(), "300");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const posted = onSave.mock.calls[0]![0];
    expect(posted.lines.map((line) => line.account_id)).toEqual([
      "a11111111-1111-4111-8111-111111111111",
      "a22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("renders an invalid amount as an explicit invalid state on the review step", async () => {
    const formatCurrency = vi.fn((amount: number | string | null | undefined) => `$${amount}`);
    await act(async () => {
      root.render(
        <StepReview
          type={feeCollection}
          form={{
            date: "2026-01-15",
            amount: "1,234",
            debitAcc: "a1000",
            creditAcc: "a4000",
            description: "Fee",
            ref: "",
            receipt: "",
            fiscal_year: "2026",
          }}
          accounts={seedAccounts}
          showAdvanced
          setShowAdvanced={vi.fn()}
          formatCurrency={formatCurrency}
        />,
      );
    });

    // "1,234" is the ambiguous single-separator form: it must read as an invalid
    // amount, never as a posted zero.
    expect(container.textContent).toContain(
      "accounting.journal.dashboard.wizard.errorAmountInvalid",
    );
    expect(container.textContent).not.toContain("accounting.journal.dashboard.wizard.postMessage");
    expect(formatCurrency).not.toHaveBeenCalled();
  });

  it("advances to review step when Enter is pressed on valid amount input", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "250.00");
    });
    await act(async () => {
      amountInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(container.textContent).toContain("accounting.journal.dashboard.wizard.postTransaction");
  });

  it("renders same account error alert on review step when both legs match", async () => {
    await act(async () => {
      root.render(
        <StepReview
          type={adjustment}
          form={{
            date: "2026-01-15",
            amount: "50",
            debitAcc: "a1000",
            creditAcc: "a1000",
            description: "Adj",
            ref: "",
            receipt: "",
            fiscal_year: "2026",
          }}
          accounts={seedAccounts}
          showAdvanced={false}
          setShowAdvanced={vi.fn()}
          formatCurrency={(amount) => `$${amount}`}
        />,
      );
    });

    expect(container.textContent).toContain("accounting.journal.dashboard.wizard.errorSameAccount");
    expect(container.textContent).not.toContain("accounting.journal.dashboard.wizard.postMessage");
  });

  it("navigates back to step 1 when clicking the completed step 1 button in the stepper", async () => {
    await renderWizard(true, feeCollection);
    expect(amountInput()).not.toBeNull();

    const step1Btn = container.querySelector(
      'nav[aria-label="accounting.journal.dashboard.wizard.stepsAria"] button',
    );
    expect(step1Btn).not.toBeNull();
    await act(async () => {
      (step1Btn as HTMLButtonElement).click();
    });

    expect(amountInput()).toBeNull();
    expect(container.textContent).toContain("accounting.journal.dashboard.group.moneyIn");
  });

  it("posts transaction when Enter is pressed on review step", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "75.00");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });

    expect(container.textContent).toContain("accounting.journal.dashboard.wizard.postTransaction");
    await act(async () => {
      const stepWrapper = container.querySelector(".space-y-4");
      stepWrapper?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].lines[0]!.debit).toBe(75);
  });

  it("surfaces an error notification if onSave rejects", async () => {
    onSave.mockRejectedValueOnce(new Error("Network Failure"));
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "100.00");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postTransaction").click();
    });

    expect(notify.error).toHaveBeenCalledWith("Network Failure");
  });

  it("posts and resets form for another transaction when Post & Record Another is clicked", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "150.00");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });

    const postAndNewBtn = findButton(container, "accounting.journal.dashboard.wizard.postAndNew");
    expect(postAndNewBtn).not.toBeNull();

    await act(async () => {
      postAndNewBtn.click();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![1]).toBe(true);
    // Wizard navigated back to step 2 with amount cleared
    expect(amountInput().value).toBe("");
    expect(notify.success).toHaveBeenCalled();
  });

  it("leaves a blank reference for the server and announces the voucher number it assigned", async () => {
    onSave.mockImplementationOnce(async (entry: JournalEntry) => ({ ...entry, ref: "JE-0042" }));
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "150.00");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.postAndNew").click();
    });

    expect(onSave.mock.calls[0]![0].ref).toBe("");
    expect(notify.success).toHaveBeenCalledWith(expect.stringContaining("JE-0042"));
  });

  it("navigates from step 3 back to step 2 when edit button is clicked on review step", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "50.00");
    });
    await act(async () => {
      findButton(container, "accounting.journal.dashboard.wizard.next").click();
    });
    expect(container.textContent).toContain("accounting.journal.dashboard.wizard.postTransaction");
    const editBtn = container.querySelector('button[aria-label^="common.edit"]');
    expect(editBtn).not.toBeNull();
    await act(async () => {
      (editBtn as HTMLButtonElement).click();
    });
    expect(amountInput()).not.toBeNull();
  });

  it("persists selected action type in sessionStorage", async () => {
    sessionStorage.clear();
    await renderWizard(true);
    const typeBtn = container.querySelector("button[aria-pressed]") as HTMLButtonElement;
    expect(typeBtn).not.toBeNull();
    await act(async () => {
      typeBtn.click();
    });
    expect(sessionStorage.getItem("mms-wizard-last-type-id")).toBeTruthy();
  });

  it("given entry templates with cash heads, should offer them by name in place of the built-in types", async () => {
    journalTemplatesMock.templates = [
      { id: "fee", name: "Hostel Fee", debitAccountId: "a1000", creditAccountId: "a4000" },
    ];
    try {
      await renderWizard(true);
      const labels = [...container.querySelectorAll("button[aria-pressed]")].map((button) =>
        button.textContent?.trim(),
      );
      expect(labels).toEqual(["Hostel Fee"]);
    } finally {
      journalTemplatesMock.templates = [];
    }
  });

  it("captures draft when closed mid-entry and offers restoration on next open", async () => {
    await renderWizard(true, feeCollection);
    await act(async () => {
      setInputValue(amountInput(), "99.99");
    });
    await renderWizard(false);
    await renderWizard(true);
    expect(notify.archivedWithUndo).toHaveBeenCalled();
  });
});
