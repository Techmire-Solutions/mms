import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnrollmentsPage from "./EnrollmentsPage";

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsPageState", () => ({
  useEnrollmentsPageState: () => ({
    t: (key: string) => key,
    SUB_TABS: [{ id: "directory", label: "Directory" }],
    TABS: [{ key: "work", label: "Enrollments" }],
    tab: "work",
    setTab: vi.fn(),
    activeSubTab: "directory",
    setActiveSubTab: vi.fn(),
    canWriteEnrollments: true,
    canDelete: true,
    canExport: true,
    canSelectEnrollments: true,
    directoryFilters: {
      listPage: 1,
      setListPage: vi.fn(),
      showDeleted: false,
      setShowDeleted: vi.fn(),
      search: "",
      setSearch: vi.fn(),
      statusFilter: "all",
      setStatusFilter: vi.fn(),
      sessionFilter: "all",
      setSessionFilter: vi.fn(),
    },
    enrollments: [],
    filteredCount: 0,
    isWorkPageError: false,
    refetchWorkPage: vi.fn(),
    viewing: null,
    setViewing: vi.fn(),
    showWizard: false,
    setShowWizard: vi.fn(),
    pendingDeleteId: null,
    setPendingDeleteId: vi.fn(),
    confirmBulkDeleteOpen: false,
    setConfirmBulkDeleteOpen: vi.fn(),
    confirmBulkRestoreOpen: false,
    setConfirmBulkRestoreOpen: vi.fn(),
    columnLayout: {
      isColumnVisible: () => true,
      getColumnWidth: () => 120,
      setColumnWidth: vi.fn(),
      columnRegistry: [],
      updateUserColumnLayout: vi.fn(),
      resetColumnLayout: vi.fn(),
      customizerLabels: {},
    },
    selection: {
      selectedIds: [],
      allVisibleSelected: false,
      someVisibleSelected: false,
      toggleSelectAll: vi.fn(),
      toggleSelectedEnrollment: vi.fn(),
      clearSelection: vi.fn(),
    },
    exportActions: {
      handleExportCSV: vi.fn(),
      handleBulkExport: vi.fn(),
    },
    pageActions: {
      handleComplete: vi.fn(),
      handleCancel: vi.fn(),
      handleDelete: vi.fn(),
      handleRestore: vi.fn(),
      handleStatusChange: vi.fn(),
      handlePaymentStatusChange: vi.fn(),
      handleBulkDelete: vi.fn(),
      handleBulkRestore: vi.fn(),
      handleBulkCancel: vi.fn(),
    },
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

vi.mock("./components/EnrollmentsCommandMetrics", () => ({
  EnrollmentsCommandMetrics: () => <div data-testid="command-metrics">Command Metrics</div>,
}));

vi.mock("./components/EnrollmentsPageHeaderActions", () => ({
  EnrollmentsPageHeaderActions: () => <div data-testid="header-actions">Header Actions</div>,
}));

let capturedWorkTierProps: any = null;
vi.mock("./components/EnrollmentsWorkTier", () => ({
  EnrollmentsWorkTier: (props: any) => {
    capturedWorkTierProps = props;
    return <div data-testid="work-tier">Work Tier</div>;
  },
}));

vi.mock("./components/EnrollmentsReportsTier", () => ({
  EnrollmentsReportsTier: () => <div data-testid="reports-tier">Reports Tier</div>,
}));

vi.mock("./components/EnrollmentsSetupTier", () => ({
  EnrollmentsSetupTier: () => <div data-testid="setup-tier">Setup Tier</div>,
}));

vi.mock("./components/EnrollmentsModalLayer", () => ({
  EnrollmentsModalLayer: () => <div data-testid="modal-layer">Modal Layer</div>,
}));

describe("EnrollmentsPage Component", () => {
  it("renders page shell, metrics, header actions, and work tier", () => {
    const html = renderToStaticMarkup(<EnrollmentsPage />);
    expect(html).toContain("nav.enrollments");
    expect(html).toContain("Header Actions");
    expect(html).toContain("Command Metrics");
    expect(html).toContain("Work Tier");
    expect(html).toContain("Modal Layer");
  });

  it("wires resetColumnLayout to columnCustomizer.onResetLayout", () => {
    renderToStaticMarkup(<EnrollmentsPage />);
    expect(capturedWorkTierProps?.columnProps?.columnCustomizer?.onResetLayout).toBeDefined();
    expect(typeof capturedWorkTierProps?.columnProps?.columnCustomizer?.onResetLayout).toBe(
      "function",
    );
  });
});
