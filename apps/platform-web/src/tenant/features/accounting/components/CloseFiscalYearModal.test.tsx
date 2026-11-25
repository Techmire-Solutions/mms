import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, FiscalYear } from "@mms/contracts";

/**
 * Regression: closing a fiscal year is irreversible, but the `closing` state flag
 * only disables the footer after a re-render. Two synchronous saves (double click
 * or click + Enter) must post the close exactly once via `useSubmitGuard`.
 */

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/tenant/features/accounting/hooks/useAccountingLedgerOps", () => ({
  useCloseFiscalYear: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: ({
    children,
    onSave,
  }: {
    children: React.ReactNode;
    onSave?: () => Promise<void> | void;
  }) => (
    <div>
      {children}
      <button
        type="button"
        data-testid="close-fy-save"
        onClick={() => {
          void onSave?.();
        }}
      >
        save
      </button>
    </div>
  ),
}));

vi.mock("@mms/fe-core/components/FormSelect", () => ({
  FormSelect: ({
    id,
    value,
    onChange,
    options,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">none</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import { CloseFiscalYearModal } from "./CloseFiscalYearModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const fiscalYear = {
  id: "fy-1",
  label: "2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
} as FiscalYear;

const accounts = [
  { id: "acct-eq-1", code: "3000", name: "Retained Earnings", type: "Equity", isActive: true },
  { id: "acct-as-1", code: "1000", name: "Cash", type: "Asset", isActive: true },
] as Account[];

describe("CloseFiscalYearModal guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({ fiscalYear: { ...fiscalYear, status: "closed" } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("collapses two synchronous saves into one mutateAsync", async () => {
    const onCloseSuccess = vi.fn();
    await act(async () => {
      root.render(
        <CloseFiscalYearModal
          closeTarget={fiscalYear}
          accounts={accounts}
          preferredRetainedEarningsAccount="acct-eq-1"
          onClose={vi.fn()}
          onCloseSuccess={onCloseSuccess}
          t={((key: string) => key) as never}
        />,
      );
    });

    const save = container.querySelector<HTMLButtonElement>('[data-testid="close-fy-save"]');
    expect(save).not.toBeNull();

    await act(async () => {
      save?.click();
      save?.click();
    });

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      id: "fy-1",
      retainedEarningsAccountId: "acct-eq-1",
    });
    expect(onCloseSuccess).toHaveBeenCalledTimes(1);
  });
});
