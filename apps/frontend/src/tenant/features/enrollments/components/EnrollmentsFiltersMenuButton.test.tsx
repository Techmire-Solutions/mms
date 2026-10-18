import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsFiltersMenuButton } from "./EnrollmentsFiltersMenuButton";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleFiltersMenuButton", () => ({
  ModuleFilterDropdown: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid="filter-dropdown">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  ),
  ModuleFilterRadioGroup: ({ label, options }: { label: string; options: { label: string }[] }) => (
    <div data-testid="filter-radio-group">
      <span>{label}</span>
      <span>{options.map((o) => o.label).join(",")}</span>
    </div>
  ),
  ModuleFilterDivider: () => <hr />,
}));

describe("EnrollmentsFiltersMenuButton Component", () => {
  it("renders filter dropdown with status and session radio groups", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsFiltersMenuButton
        statusFilter="active"
        sessionFilter="session-1"
        statusOptions={[{ value: "active", label: "Active" }]}
        sessionOptions={[{ value: "session-1", label: "Session 2024" }]}
        activeFilterCount={2}
        onStatusFilterChange={vi.fn()}
        onSessionFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.filters");
    expect(html).toContain("enrollments.filter.status");
    expect(html).toContain("enrollments.filter.session");
    expect(html).toContain("Active");
    expect(html).toContain("Session 2024");
  });
});
