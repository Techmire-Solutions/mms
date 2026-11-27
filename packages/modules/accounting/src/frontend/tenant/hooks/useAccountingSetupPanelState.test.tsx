/**
 * TODO(accounting-migration): this app-origin integration suite still mocks the
 * pre-migration app seams. The feature now lives in @mms/mod-accounting and needs a
 * module-host test harness (see the analytics host test setup) before it can run
 * against the module implementation; re-enable once that harness lands.
 */
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ACCOUNTING_PREFERENCES } from "@mms/contracts";

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: {
    accounting: {
      getPreferences: mocks.getPreferences,
      updatePreferences: mocks.updatePreferences,
    },
  },
}));

vi.mock("@mms/fe-core/auth/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ isAuthenticated: true }),
  useOptionalAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@mms/fe-core/notify", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  notify: {
    success: mocks.notifySuccess,
    error: mocks.notifyError,
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  useAccountingSetupPanelState,
  type UseAccountingSetupPanelStateReturn,
} from "./useAccountingSetupPanelState";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe.skip("useAccountingSetupPanelState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let latest: UseAccountingSetupPanelStateReturn | null;
  const onSaveFiscalYears = vi.fn(async () => {});

  beforeEach(() => {
    mocks.getPreferences.mockReset();
    mocks.updatePreferences.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
    onSaveFiscalYears.mockClear();
    latest = null;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  function Probe(): React.JSX.Element {
    latest = useAccountingSetupPanelState({ onSaveFiscalYears });
    return <div />;
  }

  async function renderPanel(): Promise<void> {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    // Second flush: TanStack Query notifies its subscribers on a macrotask, so
    // the resolved preferences need a real timer tick before the settings draft
    // can sync from them.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("seeds the settings draft from the stored preferences (retained earnings included)", async () => {
    mocks.getPreferences.mockResolvedValue({
      status: 200,
      body: {
        preferences: {
          ...DEFAULT_ACCOUNTING_PREFERENCES,
          currency: "USD",
          retainedEarningsAccount: "acc-equity-99",
        },
      },
    });

    await renderPanel();

    expect(mocks.getPreferences).toHaveBeenCalledTimes(1);
    expect(latest?.settingsDraft.currency).toBe("USD");
    expect(latest?.settingsDraft.retainedEarningsAccount).toBe("acc-equity-99");
    expect(latest?.isPrefsReady).toBe(true);
  });

  it("persists a retained-earnings change through the real PUT with the strict preferences payload", async () => {
    mocks.getPreferences.mockResolvedValue({
      status: 200,
      body: { preferences: { ...DEFAULT_ACCOUNTING_PREFERENCES } },
    });
    mocks.updatePreferences.mockResolvedValue({
      status: 200,
      body: {
        success: true,
        preferences: {
          ...DEFAULT_ACCOUNTING_PREFERENCES,
          retainedEarningsAccount: "acc-equity-7",
        },
      },
    });

    await renderPanel();

    await act(async () => {
      latest?.upd("retainedEarningsAccount", "acc-equity-7");
    });
    expect(latest?.isPrefsDirty).toBe(true);

    await act(async () => {
      await latest?.handleSave();
    });

    expect(mocks.updatePreferences).toHaveBeenCalledTimes(1);
    const sent = mocks.updatePreferences.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(sent.body.retainedEarningsAccount).toBe("acc-equity-7");
    // `accountingPreferencesPutBodySchema` is `.strict()`: exactly these keys,
    // and never the field-config keys (`fields`, `formTabs`, …) that the
    // composed AccountingSettings also carries.
    expect(Object.keys(sent.body).sort()).toEqual(
      [
        "accountCodeLength",
        "allowEditPosted",
        "autoPostDrafts",
        "currency",
        "currencySymbol",
        "dateFormat",
        "decimalPlaces",
        "decimalSeparator",
        "defaultViewLayout",
        "fyStartMonth",
        "journalTemplates",
        "organizationName",
        "requireNarration",
        "retainedEarningsAccount",
      ].sort(),
    );
    expect(sent.body.fields).toBeUndefined();
    expect(sent.body.formTabs).toBeUndefined();
    expect(mocks.notifySuccess).toHaveBeenCalledWith("accounting.settings.saved");
  });

  it("does not report success when the PUT fails, and surfaces the server message", async () => {
    mocks.getPreferences.mockResolvedValue({
      status: 200,
      body: { preferences: { ...DEFAULT_ACCOUNTING_PREFERENCES } },
    });
    // ts-rest rejects with a plain `{ status, body }` object, never an Error.
    mocks.updatePreferences.mockRejectedValue({
      status: 422,
      body: { message: "Retained earnings account is required to close a fiscal year" },
    });

    await renderPanel();

    await act(async () => {
      latest?.upd("currency", "EUR");
    });
    await act(async () => {
      await latest?.handleSave();
    });

    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(mocks.notifyError).toHaveBeenCalledWith("accounting.settings.saveFailed", {
      description: "Retained earnings account is required to close a fiscal year",
    });
  });

  it("refuses to PUT before the stored preferences have loaded", async () => {
    // Never resolves: the query keeps serving placeholder defaults.
    mocks.getPreferences.mockReturnValue(new Promise(() => {}));

    await renderPanel();

    expect(latest?.isPrefsReady).toBe(false);

    await act(async () => {
      latest?.upd("currency", "EUR");
    });
    await act(async () => {
      await latest?.handleSave();
    });

    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it("ignores edits made before the stored preferences load", async () => {
    // Never resolves: the query keeps serving placeholder defaults.
    mocks.getPreferences.mockReturnValue(new Promise(() => {}));

    await renderPanel();

    await act(async () => {
      latest?.upd("currency", "EUR");
    });

    // Keeping the edit would leave every other field on its placeholder default,
    // and the next save would PUT those defaults over the stored preferences.
    expect(latest?.settingsDraft.currency).toBe(DEFAULT_ACCOUNTING_PREFERENCES.currency);
    expect(latest?.isPrefsDirty).toBe(false);
  });

  it("saves a fiscal year through the bulk upsert and toasts only after it resolves", async () => {
    mocks.getPreferences.mockResolvedValue({
      status: 200,
      body: { preferences: { ...DEFAULT_ACCOUNTING_PREFERENCES } },
    });
    await renderPanel();

    await act(async () => {
      await latest?.handleSaveFY({
        id: "fy1",
        label: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
      });
    });

    expect(onSaveFiscalYears).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledWith("accounting.settings.fy.saved");
  });
});
