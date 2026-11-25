import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListFilters } from "./EnrollmentsListFilters";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../host/WorkListFiltersScaffold.js", () => ({
  WorkListFiltersScaffold: ({
    search,
    filterButton,
    chips,
  }: {
    search: string;
    filterButton: React.ReactNode;
    chips?: { key: string; label: string }[];
  }) => (
    <div data-testid="work-toolbar">
      <span>Search: {search}</span>
      <div>{filterButton}</div>
      <div data-testid="filter-chips">
        {chips?.map((c) => c.label).join(", ") || "Filter Chips"}
      </div>
    </div>
  ),
}));

vi.mock("@mms/fe-core/components/FilterChips", () => ({
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
