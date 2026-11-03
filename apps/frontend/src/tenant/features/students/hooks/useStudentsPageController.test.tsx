import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStudentsPageController } from "@/tenant/features/students/hooks/useStudentsPageController";

const mocks = vi.hoisted(() => ({
  setActiveTab: vi.fn(),
  setViewMode: vi.fn(),
  setListPage: vi.fn(),
  openCreateForm: vi.fn(),
  handleExportCSV: vi.fn(),
  handleBulkExport: vi.fn(),
  useGrMigration: vi.fn(),
  buildStudentsWorkSource: vi.fn(() => ({ builtWorkSource: true })),
  defaultExportColumns: vi.fn(() => [{ id: "name", label: "Name" }]),
  exportActions: vi.fn(),
}));

let viewMode: "table" | "card" = "table";

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({ viewMode, setViewMode: mocks.setViewMode }),
}));

vi.mock("@/tenant/hooks/useModuleTierPageNav", () => ({
  useModuleTierPageNav: () => ({
    canWrite: true,
    canDelete: true,
    canExport: true,
    canEditSetup: true,
    visibleTabs: ["work", "reports", "setup"],
    setActiveTab: mocks.setActiveTab,
    effectiveTab: "work",
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsAnalyticsQueries", () => ({
  useStudentsMetrics: () => ({ data: { total: 12 } }),
}));

vi.mock("@/tenant/features/students/hooks/useStudents", () => ({
  useStudentMutations: () => ({ bulkUpdateStudentStatus: { isPending: false } }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentColumnLayout", () => ({
  useStudentColumnLayout: () => ({
    columnRegistry: [],
    isColumnVisible: () => true,
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useStudentConfig: () => ({
    settings: { version: 1 },
    statuses: ["active"],
    genderFilters: ["male"],
    isFieldEnabled: () => true,
  }),
}));

vi.mock("@/tenant/features/students/hooks/useGrMigration", () => ({
  useGrMigration: (...args: unknown[]) => mocks.useGrMigration(...args),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsDirectoryFilters", () => ({
  useStudentsDirectoryFilters: () => ({
    listPage: 1,
    setListPage: mocks.setListPage,
    viewingDeleted: false,
    toggleViewingDeleted: vi.fn(),
    sortField: "grNumber",
    sortDir: "desc",
    handleServerSort: vi.fn(),
    studentSearch: "",
    setStudentSearch: vi.fn(),
    debouncedSearch: "",
    studentFilterStatus: [],
    studentFilterGender: "",
    setStudentFilterGender: vi.fn(),
    quickFilter: "all",
    changeQuickFilter: vi.fn(),
    selectedIds: [],
    clearSelection: vi.fn(),
    handleSelectOne: vi.fn(),
    handleSelectAll: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    toggleStudentStatus: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsKeyboardShortcuts", () => ({
  useStudentsKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageDirectoryProps", () => ({
  useStudentsPageDirectoryProps: () => ({ allSelected: false, someSelected: false }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageFormState", () => ({
  useStudentsPageFormState: () => ({ openCreateForm: mocks.openCreateForm, editStudent: null }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageTabPanelProps", () => ({
  useStudentsPageTabPanelProps: () => ({ tabPanelMarker: true }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsWorkTierSource", () => ({
  buildStudentsWorkSource: (...args: unknown[]) => mocks.buildStudentsWorkSource(...(args as [])),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageWorkQuery", () => ({
  useStudentsPageWorkQuery: () => ({
    workPageQuery: { data: null },
    workStudents: [],
    shownCount: 0,
  }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsSelectionTargets", () => ({
  useStudentsSelectionTargets: () => [],
}));

vi.mock("@/tenant/features/students/hooks/useStudentsCrudActions", () => ({
  useStudentsCrudActions: () => ({ handleSaveStudent: vi.fn() }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageOverlayState", () => ({
  useStudentsPageOverlayState: () => ({ overlayMarker: true }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsPageOverlayProps", () => ({
  useStudentsPageOverlayProps: () => ({ overlayPropsMarker: true }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentsExportActions", () => ({
  defaultStudentsExportColumns: (...args: unknown[]) => mocks.defaultExportColumns(...(args as [])),
  useStudentsExportActions: () => ({
    handleExportCSV: mocks.handleExportCSV,
    handleBulkExport: mocks.handleBulkExport,
  }),
}));

describe("useStudentsPageController", () => {
  let container: HTMLDivElement;
  let root: Root;
  let view: ReturnType<typeof useStudentsPageController>;

  function renderController(): void {
    function TestComponent() {
      view = useStudentsPageController();
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    viewMode = "table";
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("exposes the page shell contract from the composed hooks", () => {
    renderController();

    expect(view.canWrite).toBe(true);
    expect(view.canExport).toBe(true);
    expect(view.visibleTabs).toEqual(["work", "reports", "setup"]);
    expect(view.activeTab).toBe("work");
    expect(view.metricsTotal).toBe(12);
    expect(view.metricsSnapshot).toEqual({ total: 12 });
    expect(view.openCreateForm).toBe(mocks.openCreateForm);
    expect(view.handleExportCSV).toBe(mocks.handleExportCSV);
    expect(view.tabPanelProps).toEqual({ tabPanelMarker: true });
    expect(view.pageOverlaysProps).toEqual({ overlayPropsMarker: true });
  });

  it("falls back to the default export columns when no registry column is visible", () => {
    renderController();
    expect(mocks.defaultExportColumns).toHaveBeenCalled();
  });

  it("runs the one-shot GR migration for the active tab and setup permission", () => {
    renderController();
    expect(mocks.useGrMigration).toHaveBeenCalledWith("work", true);
  });

  it("resets the directory page when the view mode changes", () => {
    renderController();
    expect(mocks.setListPage).toHaveBeenCalledWith(1);

    mocks.setListPage.mockClear();
    viewMode = "card";
    renderController();

    expect(mocks.setListPage).toHaveBeenCalledWith(1);
  });

  it("builds the Work tier source with the resolved status options", () => {
    renderController();

    expect(mocks.buildStudentsWorkSource).toHaveBeenCalledWith(
      expect.objectContaining({
        studentStatusOptions: expect.any(Array),
        genderFilters: ["male"],
        canWrite: true,
        canDelete: true,
        canExport: true,
      }),
    );
  });
});
