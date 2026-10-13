import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsWorkTier } from "./EnrollmentsWorkTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: ({ value }: { value: string }) => <div data-testid="sub-tab-bar">Active: {value}</div>,
}));

vi.mock("./EnrollmentsBulkActionBar", () => ({
  EnrollmentsBulkActionBar: () => <div data-testid="bulk-bar">Bulk Action Bar</div>,
}));

vi.mock("./EnrollmentsList", () => ({
  EnrollmentsList: () => <div data-testid="enrollments-list">Enrollments List</div>,
}));

vi.mock("./EligibilityCheck", () => ({
  EligibilityCheck: () => <div data-testid="eligibility-check">Eligibility Check</div>,
}));

describe("EnrollmentsWorkTier Component", () => {
  it("renders directory view when activeSubTab is 'directory'", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsWorkTier
        activeSubTab="directory"
        subTabs={[
          { id: "directory", label: "Directory" },
          { id: "eligibility", label: "Eligibility" },
        ]}
        enrollments={[]}
        total={0}
        page={1}
        pageSize={25}
        search=""
        statusFilter="all"
        sessionFilter="all"
        canWrite={true}
        canDelete={true}
        canExport={true}
        canSelectEnrollments={true}
        showDeleted={false}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        isWorkListError={false}
        loadFailedTitle="Failed to load"
        onSubTabChange={vi.fn()}
        onRetry={vi.fn()}
        onShowDeletedChange={vi.fn()}
        onSearchChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onSessionFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDeleteRequest={vi.fn()}
        onRestore={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        onClearSelection={vi.fn()}
        onRequestBulkDelete={vi.fn()}
        onRequestBulkRestore={vi.fn()}
        onRequestBulkCancel={vi.fn()}
        onBulkExport={vi.fn()}
        columnProps={{
          isColumnVisible: () => true,
          getColumnWidth: () => 120,
          onColumnResize: vi.fn(),
          columnCustomizer: {} as any,
        }}
      />,
    );

    expect(html).toContain("Active: directory");
    expect(html).toContain("Bulk Action Bar");
    expect(html).toContain("Enrollments List");
  });
});
