import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, FiscalYear, OpeningBalance } from "@mms/shared";

const mocks = vi.hoisted(() => ({
  openingQuery: {
    data: undefined as OpeningBalance[] | undefined,
    isSuccess: true,
    isPlaceholderData: false,
    isError: false,
  },
  saveMutateAsync: vi.fn(),
  postMutateAsync: vi.fn(),
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: mocks.notifySuccess,
    info: mocks.notifyInfo,
    error: mocks.notifyError,
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingLedgerOps", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/tenant/features/accounting/hooks/useAccountingLedgerOps")
    >();
  return {
    ...actual,
    useOpeningBalances: () => mocks.openingQuery,
    useSaveOpeningBalances: () => ({ mutateAsync: mocks.saveMutateAsync, isPending: false }),
    usePostOpeningBalances: () => ({ mutateAsync: mocks.postMutateAsync, isPending: false }),
  };
});

import { AccountingOpeningSection } from "./AccountingOpeningSection";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const accounts: Account[] = [
  { id: "acc-1", code: "1000", name: "Cash", type: "Asset", isActive: true },
  { id: "acc-2", code: "3000", name: "Equity", type: "Equity", isActive: true },
] as unknown as Account[];

const fiscalYears: FiscalYear[] = [
  {
    id: "fy-open",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
  {
    id: "fy-closed",
    label: "FY 2025",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "closed",
  },
] as unknown as FiscalYear[];

describe("AccountingOpeningSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.openingQuery.data = undefined;
    mocks.openingQuery.isSuccess = true;
    mocks.openingQuery.isPlaceholderData = false;
    mocks.openingQuery.isError = false;
    mocks.saveMutateAsync.mockReset().mockResolvedValue({ balances: [] });
    mocks.postMutateAsync.mockReset().mockResolvedValue({ success: true, posted: true });
    mocks.notifySuccess.mockReset();
    mocks.notifyInfo.mockReset();
    mocks.notifyError.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function render(props?: { canEdit?: boolean }): void {
    act(() => {
      root.render(
        <AccountingOpeningSection
          accounts={accounts}
          fiscalYears={fiscalYears}
          decimalSeparator="period"
          canEdit={props?.canEdit}
        />,
      );
    });
  }

  function byId<T extends Element = HTMLElement>(id: string): T {
    const element = container.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`missing #${id}`);
    return element;
  }

  function setInputValue(input: HTMLInputElement, value: string): void {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function click(element: Element): Promise<void> {
    await act(async () => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function buttonByLabel(label: string): HTMLButtonElement {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );
    if (!button) throw new Error(`missing button ${label}`);
    return button as HTMLButtonElement;
  }

  const postButton = (): HTMLButtonElement => buttonByLabel("accounting.settings.opening.post");
  const addButton = (): HTMLButtonElement => buttonByLabel("accounting.settings.opening.add");

  it("reports an idempotent replay instead of a fresh posting", async () => {
    mocks.openingQuery.data = [
      { id: "ob-1", fiscalYearId: "fy-open", accountId: "acc-1", debit: 100, credit: 0 },
      { id: "ob-2", fiscalYearId: "fy-open", accountId: "acc-2", debit: 0, credit: 100 },
    ];
    mocks.postMutateAsync.mockResolvedValue({ success: true, posted: false });
    render();

    await click(postButton());

    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(mocks.notifyInfo).toHaveBeenCalledWith("accounting.settings.opening.alreadyPosted");
  });

  it("confirms a real posting", async () => {
    mocks.openingQuery.data = [
      { id: "ob-1", fiscalYearId: "fy-open", accountId: "acc-1", debit: 100, credit: 0 },
      { id: "ob-2", fiscalYearId: "fy-open", accountId: "acc-2", debit: 0, credit: 100 },
    ];
    render();

    expect(postButton().disabled).toBe(false);
    await click(postButton());

    expect(mocks.notifySuccess).toHaveBeenCalledWith("accounting.settings.opening.posted");
    expect(mocks.notifyInfo).not.toHaveBeenCalled();
  });

  it("blocks posting until the set is balanced", () => {
    mocks.openingQuery.data = [
      { id: "ob-1", fiscalYearId: "fy-open", accountId: "acc-1", debit: 100, credit: 0 },
    ];
    render();

    expect(postButton().disabled).toBe(true);
    expect(container.textContent).toContain("accounting.settings.opening.postBlockedUnbalanced");
  });

  it("keeps Add disabled while the year's rows are still a placeholder", () => {
    // `keepPreviousData` shows the previous year's rows; writing a replacement
    // from that state is what used to delete every stored balance.
    mocks.openingQuery.data = [
      { id: "ob-prev", fiscalYearId: "fy-other", accountId: "acc-1", debit: 5, credit: 0 },
    ];
    mocks.openingQuery.isPlaceholderData = true;
    render();

    expect(addButton().disabled).toBe(true);
  });

  it("renders stored rows with the account name and removes one by PUTting the rest", async () => {
    mocks.openingQuery.data = [
      { id: "ob-1", fiscalYearId: "fy-open", accountId: "acc-1", debit: 100, credit: 0 },
      { id: "ob-2", fiscalYearId: "fy-open", accountId: "acc-2", debit: 0, credit: 100 },
    ];
    render();

    expect(container.textContent).toContain("1000 – Cash");
    expect(container.textContent).toContain("3000 – Equity");
    expect(container.textContent).toContain("accounting.settings.opening.totals");

    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="accounting.settings.opening.remove 1000 – Cash"]',
    )!;
    await click(removeButton);

    expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
      fiscalYearId: "fy-open",
      balances: [
        { id: "ob-2", fiscalYearId: "fy-open", accountId: "acc-2", debit: 0, credit: 100 },
      ],
    });
  });

  it("rejects a row with both a debit and a credit before it reaches the server", async () => {
    mocks.openingQuery.data = [];
    render();

    const accountSelect = byId<HTMLSelectElement>("opening-account");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(accountSelect, "acc-1");
      accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    setInputValue(byId<HTMLInputElement>("opening-debit"), "10");
    setInputValue(byId<HTMLInputElement>("opening-credit"), "20");

    await click(addButton());

    expect(mocks.saveMutateAsync).not.toHaveBeenCalled();
    expect(container.textContent).toContain("accounting.settings.opening.singleSidedError");
  });

  it("never offers a closed year for opening balances", () => {
    render();

    const options = [...byId<HTMLSelectElement>("opening-fy").options].map(
      (option) => option.value,
    );
    expect(options).toEqual(["fy-open"]);
    expect(options).not.toContain("fy-closed");
  });

  it("given a view-only user, should hide post and add actions", () => {
    render({ canEdit: false });

    expect(
      [...container.querySelectorAll("button")].some(
        (b) => b.textContent === "accounting.settings.opening.post",
      ),
    ).toBe(false);
    expect(
      [...container.querySelectorAll("button")].some(
        (b) => b.textContent === "accounting.settings.opening.add",
      ),
    ).toBe(false);
  });
});
