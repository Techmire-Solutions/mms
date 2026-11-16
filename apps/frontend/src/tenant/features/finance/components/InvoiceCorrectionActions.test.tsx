import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@mms/shared";

/**
 * Regression 1: a same-frame double submit recorded two credit notes because the
 * `credit.isPending` flag only disables the button after a re-render. The ref-based
 * `useSubmitGuard` must collapse two synchronous submits into one `mutateAsync`.
 *
 * Regression 2: the cancel confirmation used to close optimistically. The handler
 * must resolve `false` on failure so `ConfirmAlertDialog` keeps the dialog open,
 * and it must not close while the mutation is still in flight.
 */

const mocks = vi.hoisted(() => ({
  creditMutate: vi.fn(),
  cancelMutate: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock("@/tenant/features/finance/hooks/useFinanceCollect", () => ({
  useFinanceCollectMutations: () => ({
    collect: { mutateAsync: vi.fn() },
    remind: { mutateAsync: vi.fn() },
    cancel: { mutateAsync: mocks.cancelMutate, isPending: false },
    credit: { mutateAsync: mocks.creditMutate, isPending: false },
  }),
  useFinanceCreditNotes: () => ({ data: [] }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    children,
    onSave,
    error,
  }: {
    children: React.ReactNode;
    onSave?: () => Promise<void> | void;
    error?: string;
  }) => (
    <div>
      {children}
      {error ? <p data-testid="credit-error">{error}</p> : null}
      <button
        type="button"
        data-testid="credit-save"
        onClick={() => {
          void onSave?.();
        }}
      >
        save
      </button>
    </div>
  ),
}));

import { InvoiceCorrectionActions } from "./InvoiceCorrectionActions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const invoice = {
  id: "inv-1",
  studentId: "std-1",
  studentName: "Ali Raza",
  class: "Grade 1",
  session: "2026",
  baseFee: 100,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 100,
  status: "pending",
  dueDate: "2026-01-31",
  paidAmt: 0,
  creditedAmt: 0,
} as Invoice;

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function buttonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`button not found: ${text}`);
  return button as HTMLButtonElement;
}

describe("InvoiceCorrectionActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.creditMutate.mockReset();
    mocks.cancelMutate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  async function render() {
    const onCancelled = vi.fn();
    await act(async () => {
      root.render(<InvoiceCorrectionActions invoice={invoice} onCancelled={onCancelled} />);
    });
    return { onCancelled };
  }

  it("collapses two synchronous credit submits into one mutateAsync", async () => {
    mocks.creditMutate.mockResolvedValue({ note: { id: "cn-1" } });
    await render();

    await act(async () => {
      buttonByText(container, "finance.collect.creditAction").click();
    });
    await act(async () => {
      setInputValue(
        container.querySelector<HTMLInputElement>("#credit-amount") as HTMLInputElement,
        "40",
      );
    });

    const save = container.querySelector<HTMLButtonElement>('[data-testid="credit-save"]');
    expect(save).not.toBeNull();
    await act(async () => {
      save?.click();
      save?.click();
    });

    expect(mocks.creditMutate).toHaveBeenCalledTimes(1);
    expect(mocks.creditMutate).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv-1", amount: 40 }),
    );
  });

  it("keeps the cancel confirm open when the mutation rejects, and only closes on success", async () => {
    let rejectCancel: (error: Error) => void = () => undefined;
    mocks.cancelMutate.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCancel = reject;
        }),
    );
    await render();

    await act(async () => {
      buttonByText(container, "finance.collect.cancelAction").click();
    });
    const dialog = () => document.querySelector('[role="alertdialog"]');
    expect(dialog()).not.toBeNull();

    await act(async () => {
      buttonByText(dialog() as HTMLElement, "finance.collect.cancelAction").click();
    });
    expect(mocks.cancelMutate).toHaveBeenCalledTimes(1);
    // Still open while the ledger mutation is in flight (no optimistic close).
    expect(dialog()).not.toBeNull();

    await act(async () => {
      rejectCancel(new Error("invoice already credited"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(dialog()).not.toBeNull();

    // A subsequent successful attempt resolves `true` and lets the dialog close.
    mocks.cancelMutate.mockResolvedValue({ invoice: { ...invoice, status: "cancelled" } });
    await act(async () => {
      buttonByText(dialog() as HTMLElement, "finance.collect.cancelAction").click();
      await Promise.resolve();
    });
    expect(mocks.cancelMutate).toHaveBeenCalledTimes(2);
    expect(dialog()).toBeNull();
  });
});
