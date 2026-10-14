import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Examinations from "./ExaminationsPage";

vi.mock("@/tenant/features/examinations/hooks/useExaminationsPageController", () => ({
  useExaminationsPageController: () => ({
    t: (key: string) => key,
    canWrite: true,
    canDelete: true,
    canEditSetup: true,
    showDeleted: false,
    setShowDeleted: vi.fn(),
    effectiveTab: "work",
    setActiveTab: vi.fn(),
    effectiveSubTab: "exams",
    setActiveSubTab: vi.fn(),
    effectiveConfigTab: "preferences",
    setConfigSubTab: vi.fn(),
    PAGE_TABS: [{ id: "work", label: "Examinations" }],
    SETUP_TABS: [{ id: "preferences", label: "Preferences" }],
    OPS_SUB_TABS: [{ id: "exams", label: "Exams" }],
    exams: [],
    examResults: [],
    filteredCount: 0,
    setFilteredCount: vi.fn(),
    listLoadFailed: false,
    createExamKey: 0,
    examColumnLayout: {
      isColumnVisible: () => true,
      getColumnWidth: () => undefined,
      setColumnWidth: vi.fn(),
      columnRegistry: {},
      updateUserColumnLayout: vi.fn(),
      customizerLabels: {},
    },
    resultsColumnLayout: {
      isColumnVisible: () => true,
      columnRegistry: {},
      updateUserColumnLayout: vi.fn(),
      customizerLabels: {},
    },
    refetchExams: vi.fn(),
    handleDeleteExam: vi.fn(),
    handleRestoreExam: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkRestore: vi.fn(),
    openCreateExam: vi.fn(),
    setShowMarksModal: vi.fn(),
    showExamForm: false,
    setShowExamForm: vi.fn(),
    showMarksModal: false,
    editExam: null,
    setEditExam: vi.fn(),
    activeExam: null,
    setActiveExam: vi.fn(),
    handleSaveExam: vi.fn(),
    handleSaveResults: vi.fn(),
  }),
}));

vi.mock("@/components/app/ModulePageShell", () => ({
  ModulePageShell: ({ children, headerActions, metricsStrip }: any) => (
    <div data-testid="page-shell">
      {headerActions}
      {metricsStrip}
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/ResponsiveAccordionTabs", () => ({
  ResponsiveAccordionTabs: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("./components/ExaminationsCommandMetrics", () => ({
  ExaminationsCommandMetrics: () => <div data-testid="command-metrics">Metrics</div>,
}));

vi.mock("./components/ExaminationsPageActions", () => ({
  ExaminationsPageActions: () => <div data-testid="page-actions">Actions</div>,
}));

vi.mock("./components/ExaminationsWorkTier", () => ({
  ExaminationsWorkTier: () => <div data-testid="work-tier">Work Tier</div>,
}));

vi.mock("@/tenant/components/moduleReports", () => ({
  ModuleReportsTier: () => <div data-testid="reports-tier">Reports Tier</div>,
}));

vi.mock("./components/ExaminationsSetupTier", () => ({
  ExaminationsSetupTier: () => <div data-testid="setup-tier">Setup Tier</div>,
}));

vi.mock("./components/ExaminationsModalLayer", () => ({
  ExaminationsModalLayer: () => <div data-testid="modal-layer">Modal Layer</div>,
}));

describe("ExaminationsPage Component", () => {
  it("renders examinations module shell and work tier", () => {
    const html = renderToStaticMarkup(<Examinations />);
    expect(html).toContain("Work Tier");
    expect(html).toContain("Modal Layer");
  });
});
