import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Sessions from "./SessionsPage";

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("@/tenant/features/sessions/hooks/useSessionsPageController", () => ({
  useSessionsPageController: () => ({
    t: (key: string) => key,
    canExport: true,
    canWrite: true,
    canDelete: true,
    showDeleted: false,
    shownCount: 0,
    sessions: [],
    PAGE_TABS: [{ id: "work", label: "Sessions" }],
    activeTab: "work",
    setActiveTab: vi.fn(),
    handleExportCSV: vi.fn(),
    openCreateForm: vi.fn(),
    search: "",
    filterStatus: [],
    filterType: [],
    statusOptions: [],
    typeOptions: [],
    statusLabels: {},
    typeLabels: {},
    viewMode: "table",
    setViewMode: vi.fn(),
    columnLayout: {
      isColumnVisible: () => true,
      getColumnWidth: () => undefined,
      setColumnWidth: vi.fn(),
      columnRegistry: {},
      updateUserColumnLayout: vi.fn(),
      resetColumnLayout: vi.fn(),
      customizerLabels: {},
    },
    workPageData: null,
    isError: false,
    isWorkLoading: false,
    isWorkFetching: false,
    useServerWork: true,
    canSelectSessions: true,
    selectedIds: [],
    allVisibleSelected: false,
    someVisibleSelected: false,
    sortField: "name",
    sortDir: "asc",
    statusConfig: {},
    typeConfig: {},
    setSearch: vi.fn(),
    setFilterStatus: vi.fn(),
    setFilterType: vi.fn(),
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
    setShowDeleted: vi.fn(),
    refetch: vi.fn(),
    setDetailSession: vi.fn(),
    handleSort: vi.fn(),
    toggleSelectAll: vi.fn(),
    toggleSelected: vi.fn(),
    setPendingDeleteId: vi.fn(),
    handleRestore: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkRestore: vi.fn(),
    clearSelection: vi.fn(),
    setConfirmBulkDeleteOpen: vi.fn(),
    setConfirmBulkRestoreOpen: vi.fn(),
    confirmBulkDeleteOpen: false,
    confirmBulkRestoreOpen: false,
    confirmRowDeleteOpen: false,
    setConfirmRowDeleteOpen: vi.fn(),
    handleBulkStatusUpdate: vi.fn(),
    handlePageChange: vi.fn(),
    dialogs: {
      formOpen: false,
      editSession: null,
      detailSession: null,
      pendingDeleteId: null,
      confirmRowDeleteOpen: false,
      confirmBulkDeleteOpen: false,
      confirmBulkRestoreOpen: false,
      closeForm: vi.fn(),
      closeDetail: vi.fn(),
      openEditForm: vi.fn(),
      setConfirmRowDeleteOpen: vi.fn(),
      setConfirmBulkDeleteOpen: vi.fn(),
      setConfirmBulkRestoreOpen: vi.fn(),
      setPendingDeleteId: vi.fn(),
    },
    handleSave: vi.fn(),
    handleUpdate: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

vi.mock("@/components/app/ModulePageShell", () => ({
  ModulePageShell: ({
    headerTitle,
    headerActions,
    metricsStrip,
    children,
  }: {
    headerTitle: string;
    headerActions?: React.ReactNode;
    metricsStrip?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="page-shell">
      <h1>{headerTitle}</h1>
      <div>{headerActions}</div>
      <div>{metricsStrip}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/components/app/ResponsiveAccordionTabs", () => ({
  ResponsiveAccordionTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-tabs">{children}</div>
  ),
}));

vi.mock("./components/SessionsCommandMetrics", () => ({
  SessionsCommandMetrics: () => <div data-testid="command-metrics">Command Metrics</div>,
}));

vi.mock("./components/SessionsWorkTier", () => ({
  SessionsWorkTier: () => <div data-testid="work-tier">Work Tier</div>,
}));

vi.mock("./components/SessionsDialogLayer", () => ({
  SessionsDialogLayer: () => <div data-testid="dialog-layer">Dialog Layer</div>,
}));

describe("SessionsPage Component", () => {
  it("renders page shell, metrics, and work tier using controller hook", () => {
    const html = renderToStaticMarkup(<Sessions />);
    expect(html).toContain("Sessions"); // header uses the tenant Session term (useAcademicTerms)
    expect(html).toContain("Command Metrics");
    expect(html).toContain("Work Tier");
    expect(html).toContain("Dialog Layer");
  });
});
