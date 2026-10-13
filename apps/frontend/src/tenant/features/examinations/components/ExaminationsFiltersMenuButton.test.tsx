import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsFiltersMenuButton } from "./ExaminationsFiltersMenuButton";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleFiltersMenuButton", () => ({
  ModuleFilterDropdown: ({ children, label }: any) => (
    <div data-testid="filter-dropdown">
      <span>{label}</span>
      {children}
    </div>
  ),
  ModuleFilterCheckboxGroup: ({ options }: any) => (
    <div data-testid="checkbox-group">
      {options.map((opt: any) => (
        <span key={opt.value}>{opt.label}</span>
      ))}
    </div>
  ),
}));

const mockStatusLabels = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

describe("ExaminationsFiltersMenuButton Component", () => {
  it("renders status filter options inside dropdown", () => {
    const html = renderToStaticMarkup(
      <ExaminationsFiltersMenuButton
        filterStatus={["upcoming"]}
        activeFilterCount={1}
        statusLabels={mockStatusLabels}
        onToggleStatus={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(html).toContain("examinations.filters");
    expect(html).toContain("Upcoming");
    expect(html).toContain("Completed");
  });
});
