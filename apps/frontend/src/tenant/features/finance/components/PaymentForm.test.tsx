import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentForm } from "./PaymentForm";
import { type Invoice } from "@/lib/data/financeData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.balance !== undefined) return `${key}:${params.balance}`;
      return key;
    },
  }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-admin-1", name: "Admin" },
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount}`,
    activeCurrency: { code: "USD", symbol: "$" },
  }),
}));

vi.mock("@/tenant/components/selectors/UserActorSelect", () => ({
  UserActorSelect: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (val: string) => void;
  }) => <input data-testid={id} value={value} onChange={(e) => onChange(e.target.value)} />,
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

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    error,
    onSave,
    children,
  }: {
    title: React.ReactNode;
    error?: string;
    onSave?: () => void;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button data-testid="save-payment-btn" type="button" onClick={onSave}>
        Save Payment
      </button>
    </div>
  ),
}));

const mockInvoice: Invoice = {
  id: "inv-100",
  studentId: "stu-42",
  studentName: "Hamza Tariq",
  class: "Hifz 1",
  session: "2026",
  baseFee: 500,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 500,
  paidAmt: 200,
  status: "partial",
  dueDate: "2026-09-15",
};

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("PaymentForm Component", () => {
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

  it("renders invoice info, balance, and inputMode=decimal amount input", async () => {
    await act(async () => {
      root.render(
        <PaymentForm open={true} invoice={mockInvoice} onClose={vi.fn()} onSave={vi.fn()} />,
      );
    });

    expect(container.textContent).toContain("inv-100");
    expect(container.textContent).toContain("Hamza Tariq");
    expect(container.textContent).toContain("$300");

    const amountInput = container.querySelector("#payment-amount-input") as HTMLInputElement;
    expect(amountInput).not.toBeNull();
    expect(amountInput.getAttribute("inputmode")).toBe("decimal");
    expect(amountInput.value).toBe("300");
  });

  it("shows partial payment warning when amount is less than total balance", async () => {
    await act(async () => {
      root.render(
        <PaymentForm open={true} invoice={mockInvoice} onClose={vi.fn()} onSave={vi.fn()} />,
      );
    });

    const amountInput = container.querySelector("#payment-amount-input") as HTMLInputElement;

    await act(async () => {
      setInputValue(amountInput, "150");
    });

    expect(container.textContent).toContain("finance.partialPayment:$150");
  });

  it("rejects non-numeric or exceeding amount upon save", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <PaymentForm open={true} invoice={mockInvoice} onClose={vi.fn()} onSave={onSave} />,
      );
    });

    const amountInput = container.querySelector("#payment-amount-input") as HTMLInputElement;
    const saveBtn = container.querySelector(
      "[data-testid='save-payment-btn']",
    ) as HTMLButtonElement;

    // Test exceeding balance: 500 > 300 balance
    await act(async () => {
      setInputValue(amountInput, "500");
    });

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("finance.amountExceedsBalance");

    // Test invalid non-numeric text
    await act(async () => {
      setInputValue(amountInput, "invalid");
    });

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("finance.amountRequired");
  });

  it("submits valid payment payload to onSave", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <PaymentForm open={true} invoice={mockInvoice} onClose={vi.fn()} onSave={onSave} />,
      );
    });

    const amountInput = container.querySelector("#payment-amount-input") as HTMLInputElement;
    const saveBtn = container.querySelector(
      "[data-testid='save-payment-btn']",
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(amountInput, "250.50");
    });

    await act(async () => {
      saveBtn.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 250.5,
        invoiceId: "inv-100",
        studentId: "stu-42",
        studentName: "Hamza Tariq",
        receivedByUserId: "user-admin-1",
      }),
    );
  });
});
