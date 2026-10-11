import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsWorkTier } from "./ExaminationsWorkTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/SubTabBar", () => ({
  SubTabBar: () => <div data-testid="sub-tab-bar">SubTabBar</div>,
}));

vi.mock("./ExaminationsList", () => ({
  default: () => <div data-testid="exams-list">Exams List</div>,
}));

vi.mock("./ResultsView", () => ({
  ResultsView: () => <div data-testid="results-view">Results View</div>,
}));

const mockExamLayout: any = {
  isColumnVisible: () => true,
  getColumnWidth: () => undefined,
  setColumnWidth: vi.fn(),
  columnRegistry: {},
  updateUserColumnLayout: vi.fn(),
  customizerLabels: {},
};

const mockResultsLayout: any = {
  isColumnVisible: () => true,
  columnRegistry: {},
  updateUserColumnLayout: vi.fn(),
  customizerLabels: {},
};

describe("ExaminationsWorkTier Component", () => {
  it("renders examinations list when subtab is exams", () => {
    const html = renderToStaticMarkup(
      <ExaminationsWorkTier
        tabs={[
          { id: "exams", label: "Exams" },
          { id: "results", label: "Results" },
        ]}
        activeSubTab="exams"
        showDeleted={false}
        listLoadFailed={false}
        canWrite={true}
        canDelete={true}
        createExamKey={0}
        exams={[]}
        examResults={[]}
        examColumnLayout={mockExamLayout}
        resultsColumnLayout={mockResultsLayout}
        onSubTabChange={vi.fn()}
        onToggleDeleted={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onBulkDelete={vi.fn()}
        onBulkRestore={vi.fn()}
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onFilteredCountChange={vi.fn()}
      />,
    );

    expect(html).toContain("SubTabBar");
    expect(html).toContain("Exams List");
  });

  it("renders results view when subtab is results", () => {
    const html = renderToStaticMarkup(
      <ExaminationsWorkTier
        tabs={[
          { id: "exams", label: "Exams" },
          { id: "results", label: "Results" },
        ]}
        activeSubTab="results"
        showDeleted={false}
        listLoadFailed={false}
        canWrite={true}
        canDelete={true}
        createExamKey={0}
        exams={[]}
        examResults={[]}
        examColumnLayout={mockExamLayout}
        resultsColumnLayout={mockResultsLayout}
        onSubTabChange={vi.fn()}
        onToggleDeleted={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onBulkDelete={vi.fn()}
        onBulkRestore={vi.fn()}
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onFilteredCountChange={vi.fn()}
      />,
    );

    expect(html).toContain("Results View");
  });
});
