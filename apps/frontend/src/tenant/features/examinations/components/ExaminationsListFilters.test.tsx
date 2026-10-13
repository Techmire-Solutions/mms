import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsListFilters } from "./ExaminationsListFilters";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/common/work", () => ({
  WorkTaskToolbar: ({
    filterButton,
    filterChips,
    primaryAction,
  }: {
    filterButton?: React.ReactNode;
    filterChips?: React.ReactNode;
    primaryAction?: React.ReactNode;
  }) => (
    <div data-testid="module-toolbar">
      {filterButton}
      {filterChips}
      {primaryAction}
    </div>
  ),
}));

vi.mock("./ExaminationsFiltersMenuButton", () => ({
  ExaminationsFiltersMenuButton: () => <div data-testid="filter-button">Filter Button</div>,
  EXAM_STATUSES: ["upcoming", "ongoing", "completed", "scheduled", "cancelled"],
}));

vi.mock("@/components/app/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips">Filter Chips</div>,
}));

const mockStatusLabels = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

describe("ExaminationsListFilters Component", () => {
  it("renders toolbar with search and filter chips", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListFilters
        viewMode="table"
        onViewModeChange={vi.fn()}
        search=""
        filterStatus={[]}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        statusLabels={mockStatusLabels}
        onSearchChange={vi.fn()}
        onToggleStatus={vi.fn()}
        onClearStatuses={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    expect(html).toContain("Filter Button");
    expect(html).toContain("Filter Chips");
    expect(html).not.toContain("examinations.newExam");
  });
});
