import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceListFilters } from "./AttendanceListFilters";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleWorkToolbar", () => ({
  ModuleWorkToolbar: ({
    children,
    filterChips,
  }: {
    children: React.ReactNode;
    filterChips?: React.ReactNode;
  }) => (
    <div data-testid="module-toolbar">
      {children}
      {filterChips}
    </div>
  ),
}));

vi.mock("./AttendanceFiltersMenuButton", () => ({
  AttendanceFiltersMenuButton: () => <div data-testid="filter-button">Filter Button</div>,
}));

vi.mock("@/components/app/DateRangeFilterBar", () => ({
  DateRangeFilterBar: () => <div data-testid="date-filter">Date Filter</div>,
}));

vi.mock("@/components/app/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips">Filter Chips</div>,
}));

describe("AttendanceListFilters Component", () => {
  it("renders toolbar and date range filter bar", () => {
    const html = renderToStaticMarkup(
      <AttendanceListFilters
        viewMode="table"
        onViewModeChange={vi.fn()}
        search=""
        handleSearchChange={vi.fn()}
        statusFilter="all"
        setStatusFilter={vi.fn()}
        statuses={[]}
        statusLabel={() => ""}
        dateFrom=""
        setDateFrom={vi.fn()}
        dateTo=""
        setDateTo={vi.fn()}
        setPage={vi.fn()}
      />,
    );

    expect(html).toContain("Date Filter");
    expect(html).toContain("Filter Chips");
  });
});
