import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnrollmentsPageState } from "./useEnrollmentsPageState";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: true,
    canManage: true,
    canDelete: true,
    canExport: true,
    canReports: true,
    canViewSetup: true,
  }),
}));

vi.mock("@mms/fe-core/lib/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [],
}));

vi.mock("@mms/fe-core/lib/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, defaultValue: string) => [defaultValue, vi.fn()],
}));

vi.mock("@mms/fe-core/lib/useModuleShortcuts", () => ({
  useModuleShortcuts: () => undefined,
}));

vi.mock("@/lib/query/useWorkDrillDownListener", () => ({
  useWorkDrillDownListener: () => undefined,
}));

vi.mock("@mms/fe-core/hooks", () => ({
  useDebounce: (value: string) => value,
}));

vi.mock("@mms/fe-core/lib/useDirectoryTrashState", () => ({
  useDirectoryTrashState: () => [false, vi.fn()],
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsApi", () => ({
  useEnrollmentsPaginated: () => ({
    data: { body: { enrollments: [], total: 0 } },
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsPageActions", () => ({
  useEnrollmentsPageActions: () => ({
    handleComplete: vi.fn(),
    handleCancel: vi.fn(),
    handleDelete: vi.fn(),
    handleRestore: vi.fn(),
    handleStatusChange: vi.fn(),
    handlePaymentStatusChange: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkRestore: vi.fn(),
    handleBulkCancel: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsExportActions", () => ({
  useEnrollmentsExportActions: () => ({
    handleExportCSV: vi.fn(),
    handleBulkExport: vi.fn(),
    isExporting: false,
  }),
  defaultEnrollmentsExportColumns: () => [],
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentColumnLayout", () => ({
  useEnrollmentColumnLayout: () => ({
    columnRegistry: [],
    isColumnVisible: () => true,
    getColumnWidth: () => 120,
    setColumnWidth: vi.fn(),
    updateUserColumnLayout: vi.fn(),
    resetColumnLayout: vi.fn(),
    customizerLabels: {},
  }),
}));

vi.mock("@/tenant/features/enrollments/components/EnrollmentsListFilters", () => ({
  ENROLLMENTS_WORK_SEARCH_INPUT_ID: "enrollments-work-search-input",
}));

let hookResult: ReturnType<typeof useEnrollmentsPageState> | null = null;

function TestComponent(): React.JSX.Element {
  hookResult = useEnrollmentsPageState();
  return React.createElement("div");
}

describe("useEnrollmentsPageState selection lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    hookResult = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("clears the row selection when a server-side filter dimension changes", async () => {
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    await act(async () => {
      hookResult?.selection.toggleSelected("enr-1", true);
    });
    expect(hookResult?.selection.selectedIds).toEqual(["enr-1"]);

    await act(async () => {
      hookResult?.directoryFilters.setStatusFilter("confirmed");
    });
    expect(hookResult?.selection.selectedIds).toEqual([]);
  });

  it("keeps the selection across pagination changes", async () => {
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    await act(async () => {
      hookResult?.selection.toggleSelected("enr-1", true);
    });
    expect(hookResult?.selection.selectedIds).toEqual(["enr-1"]);

    await act(async () => {
      hookResult?.directoryFilters.setListPage(2);
    });
    expect(hookResult?.selection.selectedIds).toEqual(["enr-1"]);
  });
});
