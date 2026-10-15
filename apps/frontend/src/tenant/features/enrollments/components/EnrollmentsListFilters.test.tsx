import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListFilters } from "./EnrollmentsListFilters";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleWorkToolbar", () => ({
  ModuleWorkToolbar: ({
    search,
    filterButton,
    filterChips,
  }: {
    search: string;
    filterButton: React.ReactNode;
    filterChips?: React.ReactNode;
  }) => (
    <div data-testid="work-toolbar">
      <span>Search: {search}</span>
      <div>{filterButton}</div>
      {filterChips}
    </div>
  ),
}));

vi.mock("@/components/app/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips">Filter Chips</div>,
}));

vi.mock("./EnrollmentsFiltersMenuButton", () => ({
  EnrollmentsFiltersMenuButton: () => <div data-testid="menu-btn">Filters Menu Button</div>,
}));

describe("EnrollmentsListFilters Component", () => {
  it("renders toolbar and filter chips", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListFilters
        search="Ali"
        statusFilter="all"
        sessionFilter="all"
        sessions={[]}
        showDeleted={false}
        canDelete={true}
        statusConfig={{}}
        columnCustomizer={{} as unknown as never}
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onSessionChange={vi.fn()}
        onClearFilters={vi.fn()}
        viewMode="table"
        onViewModeChange={vi.fn()}
      />,
    );

    expect(html).toContain("Search: Ali");
    expect(html).toContain("Filters Menu Button");
    expect(html).toContain("Filter Chips");
  });
});
