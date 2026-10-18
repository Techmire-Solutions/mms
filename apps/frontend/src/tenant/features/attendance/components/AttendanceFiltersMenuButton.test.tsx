import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceFiltersMenuButton } from "./AttendanceFiltersMenuButton";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleFiltersMenuButton", () => ({
  ModuleFilterDropdown: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div data-testid="filter-dropdown">
      <span>{label}</span>
      {children}
    </div>
  ),
  ModuleFilterRadioGroup: ({ label, options }: { label: string; options: { label: string }[] }) => (
    <div data-testid="radio-group">
      <span>{label}</span>
      <span>{options.map((o) => o.label).join(", ")}</span>
    </div>
  ),
}));

describe("AttendanceFiltersMenuButton Component", () => {
  it("renders filter options with statuses", () => {
    const html = renderToStaticMarkup(
      <AttendanceFiltersMenuButton
        statusFilter="all"
        activeFilterCount={0}
        statuses={[{ id: "present", label: "Present" } as unknown as never]}
        statusLabel={(id) => id.toUpperCase()}
        onChangeStatus={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(html).toContain("attendance.filters");
    expect(html).toContain("attendance.filter.status");
    expect(html).toContain("PRESENT");
  });
});
