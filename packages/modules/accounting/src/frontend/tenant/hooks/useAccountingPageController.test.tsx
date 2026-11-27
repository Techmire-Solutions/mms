/**
 * TODO(accounting-migration): this app-origin integration suite still mocks the
 * pre-migration app seams. The feature now lives in @mms/mod-accounting and needs a
 * module-host test harness (see the analytics host test setup) before it can run
 * against the module implementation; re-enable once that harness lands.
 */
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useAccountingPageController } from "./useAccountingPageController";

const mockUseModulePermissions = vi.fn();
const mockUseFilteredModuleTierTabs = vi.fn();

vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("../host/usePermissions", () => ({
  useModulePermissions: () => mockUseModulePermissions(),
}));

vi.mock("@mms/fe-core/lib/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: (args: unknown) => mockUseFilteredModuleTierTabs(args),
}));

vi.mock("@mms/fe-core/lib/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, initial: string) => React.useState(initial),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@mms/fe-core/lib/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => React.useState(false),
}));

vi.mock("./useAccountingJournalColumnLayout", () => ({
  useAccountingJournalColumnLayout: () => ({}),
}));

vi.mock("./useAccountingAccountColumnLayout", () => ({
  useAccountingAccountColumnLayout: () => ({}),
}));

vi.mock("../host/useStandardModuleConfig", () => ({
  useAccountingConfig: () => ({
    settings: { decimalSeparator: "period" },
  }),
}));

vi.mock("../host/useCurrency", () => ({
  useAccountingCurrency: () => ({
    activeCurrency: { code: "PKR" },
  }),
}));

vi.mock("./useAccountingApi", () => ({
  useAccountingFiscalYearsPaginated: () => ({ data: [] }),
  useAllAccountingAccounts: () => ({ data: [] }),
}));

vi.mock("./accountingListFetch", () => ({
  useAccountingEntriesPage: () => ({ data: { entries: [], total: 0 } }),
}));

vi.mock("../lib/journalEntriesControllerFilters", () => ({
  useJournalEntriesListQueryState: () => ({
    query: {},
    page: 1,
    filters: {},
    patchFilters: vi.fn(),
    setPage: vi.fn(),
  }),
}));

vi.mock("./useAccountingPageActions", () => ({
  useAccountingPageActions: () => ({
    setAccounts: vi.fn(),
    setEntries: vi.fn(),
    setFiscalYears: vi.fn(),
    handleDeleteEntry: vi.fn(),
    handleRestoreEntry: vi.fn(),
    handleBulkDeleteEntries: vi.fn(),
    handleBulkRestoreEntries: vi.fn(),
  }),
}));

vi.mock("./useAccountingPageShortcuts", () => ({
  useAccountingPageShortcuts: () => ({
    handleShortcutStateChange: vi.fn(),
  }),
}));

function renderHook(hook: () => ReturnType<typeof useAccountingPageController>) {
  let result!: ReturnType<typeof useAccountingPageController>;
  function TestComponent() {
    result = hook();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<TestComponent />);
  });
  return { result, unmount: () => act(() => root.unmount()) };
}

describe.skip("useAccountingPageController", () => {
  it("given accountant permissions (no setupView), delegates canViewSetup=false to useFilteredModuleTierTabs", () => {
    mockUseModulePermissions.mockReturnValue({
      canWrite: true,
      canDelete: true,
      canReports: true,
      canViewSetup: false,
    });
    mockUseFilteredModuleTierTabs.mockReturnValue([
      { id: "work", label: "nav.accounting" },
      { id: "reports", label: "nav.reports" },
    ]);

    const { result, unmount } = renderHook(useAccountingPageController);

    expect(mockUseFilteredModuleTierTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        canViewSetup: false,
        canViewReports: true,
      }),
    );
    expect(result.canWrite).toBe(true);
    expect(result.subTabs.map((s) => s.id)).toEqual([
      "overview",
      "journal",
      "ledger",
      "trial",
      "coa",
      "banking",
      "periodEnd",
    ]);

    unmount();
  });

  it("given admin permissions (with setupView), delegates canViewSetup=true", () => {
    mockUseModulePermissions.mockReturnValue({
      canWrite: true,
      canDelete: true,
      canReports: true,
      canViewSetup: true,
    });
    mockUseFilteredModuleTierTabs.mockReturnValue([
      { id: "work", label: "nav.accounting" },
      { id: "reports", label: "nav.reports" },
      { id: "setup", label: "nav.setup" },
    ]);

    const { result, unmount } = renderHook(useAccountingPageController);

    expect(mockUseFilteredModuleTierTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        canViewSetup: true,
      }),
    );
    expect(result.pageTabs).toHaveLength(3);

    unmount();
  });
});
