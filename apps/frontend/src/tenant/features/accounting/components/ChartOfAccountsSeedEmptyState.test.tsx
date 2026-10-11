import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";

const mocks = vi.hoisted(() => ({
  seedMutateAsync: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: mocks.notifySuccess,
    error: mocks.notifyError,
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/accounting/hooks/useSeedDefaultChart", () => ({
  useSeedDefaultChart: () => ({ mutateAsync: mocks.seedMutateAsync, isPending: false }),
}));

vi.mock("@/components/ui/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({
    open,
    title,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => Promise<void>;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="confirm"
        aria-label={title}
        onClick={() => void onConfirm()}
      />
    ) : null,
}));

import { ChartOfAccountsSeedEmptyState } from "./ChartOfAccountsSeedEmptyState";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ChartOfAccountsSeedEmptyState", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onAddAccount = vi.fn();

  beforeEach(() => {
    mocks.seedMutateAsync.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
    onAddAccount.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = (canWrite: boolean): void => {
    act(() =>
      root.render(
        <ChartOfAccountsSeedEmptyState canWrite={canWrite} onAddAccount={onAddAccount} />,
      ),
    );
  };

  const button = (label: string): HTMLButtonElement | undefined =>
    [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);

  async function click(element: Element): Promise<void> {
    await act(async () => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  async function confirmSeed(): Promise<void> {
    const seedButton = button("accounting.coa.seed.action");
    if (!seedButton) throw new Error("missing seed button");
    await click(seedButton);
    expect(mocks.seedMutateAsync).not.toHaveBeenCalled();
    const confirm = container.querySelector('[data-testid="confirm"]');
    if (!confirm) throw new Error("missing confirmation");
    await click(confirm);
  }

  it("seeds only after confirmation and reports the settings it filled", async () => {
    mocks.seedMutateAsync.mockResolvedValue({
      success: true,
      count: 61,
      defaultsApplied: { retainedEarnings: true, cashAccount: true },
    });
    render(true);

    await confirmSeed();

    expect(mocks.seedMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledWith("accounting.coa.seed.success", {
      description:
        "accounting.coa.seed.successCount accounting.coa.seed.retainedEarningsSet accounting.coa.seed.cashAccountSet",
    });
  });

  it("omits settings that were already configured", async () => {
    mocks.seedMutateAsync.mockResolvedValue({
      success: true,
      count: 61,
      defaultsApplied: { retainedEarnings: false, cashAccount: false },
    });
    render(true);

    await confirmSeed();

    expect(mocks.notifySuccess).toHaveBeenCalledWith("accounting.coa.seed.success", {
      description: "accounting.coa.seed.successCount",
    });
  });

  it("explains a conflict when another user already created accounts", async () => {
    mocks.seedMutateAsync.mockRejectedValue(new ApiError(409, "exists", "conflict"));
    render(true);

    await confirmSeed();

    expect(mocks.notifyError).toHaveBeenCalledWith("accounting.coa.seed.alreadyExists");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it("reports a generic failure for other errors", async () => {
    mocks.seedMutateAsync.mockRejectedValue(new ApiError(500, "boom", "database_error"));
    render(true);

    await confirmSeed();

    expect(mocks.notifyError).toHaveBeenCalledWith("accounting.coa.seed.failed");
  });

  it("offers manual account creation", async () => {
    render(true);
    const addButton = button("accounting.coa.addAccount");
    if (!addButton) throw new Error("missing add button");
    await click(addButton);
    expect(onAddAccount).toHaveBeenCalledTimes(1);
  });

  it("hides actions for read-only users", () => {
    render(false);
    expect(button("accounting.coa.seed.action")).toBeUndefined();
    expect(container.textContent).toContain("accounting.coa.seed.emptyReadOnly");
  });
});
