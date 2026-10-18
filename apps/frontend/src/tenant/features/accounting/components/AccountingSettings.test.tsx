import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { AccountingSettings } from "./AccountingSettings";

const mocks = vi.hoisted(() => ({
  closeMutateAsync: vi.fn(),
  handleSave: vi.fn(),
  preferencesProps: null as Record<string, unknown> | null,
  prefsReady: true,
  prefsLoadFailed: false,
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockCanEdit = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEdit,
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingSetupPanelState", () => ({
  useAccountingSetupPanelState: () => ({
    settingsDraft: {
      currency: "PKR",
      currencySymbol: "₨",
      dateFormat: "DD/MM/YYYY",
      decimalSeparator: "period",
      decimalPlaces: 2,
      fyStartMonth: "July",
      accountCodeLength: 4,
      requireNarration: true,
      allowEditPosted: false,
      autoPostDrafts: false,
      retainedEarningsAccount: "a3100",
      defaultViewLayout: "list",
    },
    upd: vi.fn(),
    saved: true,
    saving: false,
    isPrefsDirty: false,
    isDirty: false,
    isPrefsReady: mocks.prefsReady,
    isPrefsLoadFailed: mocks.prefsLoadFailed,
    handleSave: mocks.handleSave,
    decimalSeparators: [],
    fyStatusConfig: {},
    currencies: [],
    activeCurrency: undefined,
    fyModal: null,
    setFyModal: vi.fn(),
    handleSaveFY: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/accounting/hooks/useAccountingLedgerOps", () => ({
  useCloseFiscalYear: () => ({ mutateAsync: mocks.closeMutateAsync }),
}));

vi.mock("./AccountingSettingsPreferences", () => ({
  AccountingSettingsPreferences: (props: Record<string, unknown>) => {
    mocks.preferencesProps = props;
    return <div data-testid="preferences-section">Accounting Preferences Section</div>;
  },
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: ({ dirty }: { dirty: boolean }) => (
    <div data-testid="save-footer" data-dirty={String(dirty)}>
      Save Footer
    </div>
  ),
}));

vi.mock("./AccountingFiscalYearModal", () => ({
  AccountingFiscalYearModal: () => null,
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: () => null,
}));

describe("AccountingSettings Component", () => {
  beforeEach(() => {
    mocks.prefsReady = true;
    mocks.prefsLoadFailed = false;
    mocks.closeMutateAsync.mockReset().mockResolvedValue({
      fiscalYear: { id: "fy1", label: "FY 2025", status: "closed" },
    });
    mocks.preferencesProps = null;
  });

  it("renders preferences, fiscal year modal, and save footer", () => {
    const html = renderToStaticMarkup(
      <AccountingSettings accounts={[]} fiscalYears={[]} onSaveFiscalYears={vi.fn()} />,
    );
    expect(html).toContain("Accounting Preferences Section");
    expect(html).toContain("Save Footer");
  });

  it("disables the Preferences save until the stored preferences have loaded", () => {
    mocks.prefsReady = false;
    const html = renderToStaticMarkup(
      <AccountingSettings accounts={[]} fiscalYears={[]} onSaveFiscalYears={vi.fn()} />,
    );

    expect(html).toContain("accounting.settings.prefsLoading");
    expect(html).toContain('data-dirty="false"');
  });

  it("explains a failed preferences load instead of offering a save", () => {
    mocks.prefsReady = false;
    mocks.prefsLoadFailed = true;
    const html = renderToStaticMarkup(
      <AccountingSettings accounts={[]} fiscalYears={[]} onSaveFiscalYears={vi.fn()} />,
    );

    expect(html).toContain("accounting.settings.prefsLoadFailed");
    expect(html).toContain('data-dirty="false"');
  });

  it("never closes a fiscal year straight from the row action", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(
        <AccountingSettings
          accounts={[]}
          fiscalYears={[
            {
              id: "fy1",
              label: "FY 2025",
              startDate: "2025-01-01",
              endDate: "2025-12-31",
              status: "active",
            } as never,
          ]}
          onSaveFiscalYears={vi.fn()}
        />,
      );
    });

    const requestClose = mocks.preferencesProps?.onRequestCloseFiscalYear as
      ((fiscalYearId: string) => void) | undefined;
    expect(typeof requestClose).toBe("function");

    await act(async () => {
      requestClose?.("fy1");
    });

    // Closing is irreversible, so the row action only opens the confirmation —
    // it must not fire the close request on a single click.
    expect(mocks.closeMutateAsync).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("sends the chosen retained-earnings account when the close is confirmed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onSaveFiscalYears = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <AccountingSettings
          accounts={[
            {
              id: "a3100",
              code: "3100",
              name: "Retained Earnings",
              type: "Equity",
              isActive: true,
            } as never,
          ]}
          fiscalYears={[
            {
              id: "fy1",
              label: "FY 2025",
              startDate: "2025-01-01",
              endDate: "2025-12-31",
              status: "active",
            } as never,
          ]}
          onSaveFiscalYears={onSaveFiscalYears}
        />,
      );
    });

    const requestClose = mocks.preferencesProps?.onRequestCloseFiscalYear as
      ((fiscalYearId: string) => void) | undefined;

    await act(async () => {
      requestClose?.("fy1");
    });

    const confirmButton = [...document.body.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("accounting.settings.fy.close"),
    );
    expect(confirmButton).toBeDefined();
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.closeMutateAsync).toHaveBeenCalledWith({
      id: "fy1",
      retainedEarningsAccountId: "a3100",
    });

    await act(async () => root.unmount());
    container.remove();
  });
});
