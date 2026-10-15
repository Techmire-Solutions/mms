import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListContent } from "./EnrollmentsListContent";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock("./EnrollmentsListCards", () => ({
  EnrollmentsListCards: () => <div data-testid="list-cards">List Cards</div>,
}));

vi.mock("./EnrollmentsListDesktopTable", () => ({
  EnrollmentsListDesktopTable: () => <div data-testid="list-table">List Table</div>,
}));

vi.mock("@/components/app/ListPagination", () => ({
  ListPagination: () => <div data-testid="pagination">Pagination</div>,
}));

describe("EnrollmentsListContent Component", () => {
  it("renders empty state when enrollments is empty", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListContent
        viewMode="table"
        enrollments={[]}
        filteredCount={0}
        page={1}
        pageSize={25}
        students={[]}
        isColumnVisible={() => true}
        columnRegistry={[]}
        canSelectEnrollments={true}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        statusConfig={{}}
        paymentConfig={{}}
        formatCurrency={(val) => `$${val}`}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.empty.title");
    expect(html).toContain("Pagination");
  });

  it("renders table when viewMode is table", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListContent
        viewMode="table"
        enrollments={[{ id: "enr-1" } as unknown as never]}
        filteredCount={1}
        page={1}
        pageSize={25}
        students={[]}
        isColumnVisible={() => true}
        columnRegistry={[]}
        canSelectEnrollments={true}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        statusConfig={{}}
        paymentConfig={{}}
        formatCurrency={(val) => `$${val}`}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("List Table");
  });

  it("renders cards when viewMode is cards", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListContent
        viewMode="cards"
        enrollments={[{ id: "enr-1" } as unknown as never]}
        filteredCount={1}
        page={1}
        pageSize={25}
        students={[]}
        isColumnVisible={() => true}
        columnRegistry={[]}
        canSelectEnrollments={true}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        statusConfig={{}}
        paymentConfig={{}}
        formatCurrency={(val) => `$${val}`}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("List Cards");
  });
});
