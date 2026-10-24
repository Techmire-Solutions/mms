import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceForm } from "./InvoiceForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount}`,
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useFinanceConfig: () => ({
    settings: {
      dueDays: 14,
      invoicePrefix: "INV",
    },
  }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceFeeStructures", () => ({
  useFinanceFeeStructures: () => ({ data: [] }),
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsContractList: () => ({ data: undefined }),
}));

vi.mock("@/tenant/hooks/collections/faculty", () => ({
  useFacultyContractList: () => ({ data: undefined }),
}));

vi.mock("@/components/app/DatePicker", () => ({
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

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    title,
    error,
    onSave,
    saveDisabled,
    children,
  }: {
    title: React.ReactNode;
    error?: string;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button data-testid="save-invoice-btn" type="button" disabled={saveDisabled} onClick={onSave}>
        Save Invoice
      </button>
    </div>
  ),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("InvoiceForm Component", () => {
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

  it("renders form inputs with inputMode=decimal on baseFee and discountValue", async () => {
    await act(async () => {
      root.render(<InvoiceForm open={true} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    const baseFeeInput = container.querySelector("#invoice-base-fee") as HTMLInputElement;
    const discountInput = container.querySelector("#invoice-discount-value") as HTMLInputElement;

    expect(baseFeeInput).not.toBeNull();
    expect(baseFeeInput.getAttribute("inputmode")).toBe("decimal");

    expect(discountInput).not.toBeNull();
    expect(discountInput.getAttribute("inputmode")).toBe("decimal");
  });

  it("disables save button when required fields are missing", async () => {
    await act(async () => {
      root.render(<InvoiceForm open={true} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    const saveBtn = container.querySelector(
      "[data-testid='save-invoice-btn']",
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("submits valid invoice payload when required fields and positive fee are populated", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(<InvoiceForm open={true} onClose={vi.fn()} onSave={onSave} />);
    });

    const studentNameInput = container.querySelector("#invoice-student-name") as HTMLInputElement;
    const studentIdInput = container.querySelector("#invoice-student-id") as HTMLInputElement;
    const classInput = container.querySelector("#invoice-class") as HTMLInputElement;
    const sessionInput = container.querySelector("#invoice-session") as HTMLInputElement;
    const baseFeeInput = container.querySelector("#invoice-base-fee") as HTMLInputElement;
    const saveBtn = container.querySelector(
      "[data-testid='save-invoice-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(studentNameInput, "Yusuf Harith");
      setInputValue(studentIdInput, "stu-99");
      setInputValue(classInput, "Class A");
      setInputValue(sessionInput, "2026-2027");
      setInputValue(baseFeeInput, "450.00");
    });

    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: "Yusuf Harith",
        studentId: "stu-99",
        class: "Class A",
        session: "2026-2027",
        baseFee: 450,
        finalAmt: 450,
        status: "pending",
      }),
    );
  });

  it("updates field values and allows clearing inputs", async () => {
    await act(async () => {
      root.render(<InvoiceForm open={true} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    const studentNameInput = container.querySelector("#invoice-student-name") as HTMLInputElement;
    await act(async () => {
      setInputValue(studentNameInput, "Ali Reza");
    });
    expect(studentNameInput.value).toBe("Ali Reza");

    await act(async () => {
      setInputValue(studentNameInput, "");
    });
    expect(studentNameInput.value).toBe("");
  });
});
