import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentReportView } from "./StudentReportView";
import type { StudentReportViewModel } from "./reportViewModels";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function report(overrides: Partial<StudentReportViewModel> = {}): StudentReportViewModel {
  return {
    activeSubTab: "list",
    setActiveSubTab: vi.fn(),
    REPORT_TABS: [
      { key: "list", label: "students.report.studentListTab" },
      { key: "history", label: "students.report.enrollmentHistoryTab" },
    ],
    t: (key: string) => key,
    filters: {},
    reportStatusFilter: null,
    setReportStatusFilter: vi.fn(),
    students: [],
    enrollments: [],
    studentExportColumns: [{ key: "name", header: "Name" }],
    enrollmentExportColumns: [{ key: "student", header: "Student" }],
    resolveStudentExportRows: vi.fn(async () => []),
    resolveEnrollmentExportRows: vi.fn(async () => []),
    listPage: 1,
    setListPage: vi.fn(),
    listTotal: 0,
    listHasMore: false,
    historyPage: 1,
    setHistoryPage: vi.fn(),
    historyTotal: 0,
    historyHasMore: false,
    listLoading: false,
    historyLoading: false,
    listError: false,
    historyError: false,
    listRefetch: vi.fn(),
    retryHistory: vi.fn(),
    statusBadgeConfig: {},
    enrollmentStatusConfig: {},
    ...overrides,
  } as unknown as StudentReportViewModel;
}

describe("StudentReportView", () => {
  it("renders a single grid container/toolbar for the active tab", () => {
    // 2026-11-04 review (M3): the view wrapped `StudentReportTables`, which wrapped a
    // second ReportDataGridContainer — two titles/toolbars and a page-only export.
    const html = renderToStaticMarkup(<StudentReportView report={report()} />);

    const toolbarTitles =
      html.match(/font-semibold text-foreground">students\.report\.studentListTab/g) ?? [];
    expect(toolbarTitles).toHaveLength(1);
  });

  it("keeps the tab bar and reports the failure inside the active tab", () => {
    // 2026-11-04 review (n16): a list error used to replace the whole shell and hide the
    // Enrollment History tab with it.
    const html = renderToStaticMarkup(<StudentReportView report={report({ listError: true })} />);

    expect(html).toContain("students.report.loadFailed");
    expect(html).toContain("students.report.enrollmentHistoryTab");
  });
});
