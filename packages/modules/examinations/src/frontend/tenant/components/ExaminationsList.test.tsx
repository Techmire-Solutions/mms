import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExaminationsList from "./ExaminationsList";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal: any) => {
  const actual = await (importOriginal as any)("@mms/fe-core/tenant");
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({
      viewMode: "table",
      setViewMode: vi.fn(),
    }),
  };
});

vi.mock("../hooks/useExamSelection", () => ({
  useExamSelection: () => ({
    selectedIds: [],
    setSelectedIds: vi.fn(),
    allVisibleSelected: false,
    someVisibleSelected: false,
    toggleSelectAll: vi.fn(),
    toggleSelectedExam: vi.fn(),
  }),
}));

vi.mock("../hooks/useExaminationsQueries", () => ({
  useExaminationsContractList: () => ({
    data: {
      status: 200,
      body: {
        exams: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../host/useSessions", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("../host/useEnrollments", () => ({
  useEnrollmentsCollection: () => [],
}));

vi.mock("./ExaminationsListFilters", () => ({
  ExaminationsListFilters: () => <div data-testid="list-filters">List Filters</div>,
}));

vi.mock("./ExaminationsListContent", () => ({
  ExaminationsListContent: () => <div data-testid="list-content">List Content</div>,
}));

vi.mock("@mms/fe-core/components/ListPagination", () => ({
  ListPagination: () => <div data-testid="list-pagination">List Pagination</div>,
}));

vi.mock("@mms/fe-core/components/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: () => null,
}));

describe("ExaminationsList Component", () => {
  it("renders filters, content, and pagination", () => {
    const html = renderToStaticMarkup(<ExaminationsList onNew={vi.fn()} onEdit={vi.fn()} />);

    expect(html).toContain("List Filters");
    expect(html).toContain("List Content");
    expect(html).toContain("List Pagination");
  });
});
