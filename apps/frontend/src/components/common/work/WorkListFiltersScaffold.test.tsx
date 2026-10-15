import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkListFiltersScaffold, type WorkListFiltersScaffoldProps } from "./WorkListFiltersScaffold";

describe("WorkListFiltersScaffold", () => {
  const baseProps: WorkListFiltersScaffoldProps = {
    regionLabel: "Payments filters",
    search: "",
    onSearchChange: vi.fn(),
    searchPlaceholder: "Search payments…",
    searchId: "payments-work-search",
    activeFilterCount: 0,
    clearFiltersLabel: "Clear filters",
    onClearFilters: vi.fn(),
    chips: [],
  };

  it("renders the toolbar region with search input wiring", () => {
    const html = renderToStaticMarkup(<WorkListFiltersScaffold {...baseProps} />);
    expect(html).toContain('role="region"');
    expect(html).toContain("Payments filters");
    expect(html).toContain("payments-work-search");
    expect(html).toContain("Search payments…");
  });

  it("renders filter chips with remove affordances and clear-all", () => {
    const html = renderToStaticMarkup(
      <WorkListFiltersScaffold
        {...baseProps}
        activeFilterCount={1}
        chips={[
          { key: "status:paid", label: "Paid", onRemove: vi.fn() },
          { key: "session:1", label: "Fall 2026", onRemove: vi.fn() },
        ]}
      />,
    );
    expect(html).toContain("Paid");
    expect(html).toContain("Fall 2026");
    expect(html).toContain("Clear filters");
  });

  it("wires trash toggle only when deletable", () => {
    const html = renderToStaticMarkup(
      <WorkListFiltersScaffold
        {...baseProps}
        trashToggle={{
          canViewDeleted: true,
          viewingDeleted: false,
          onToggle: vi.fn(),
          activeLabel: "Show active",
          deletedLabel: "Show deleted",
        }}
      />,
    );
    expect(html).toContain("Show deleted");

    const viewingDeleted = renderToStaticMarkup(
      <WorkListFiltersScaffold
        {...baseProps}
        trashToggle={{
          canViewDeleted: true,
          viewingDeleted: true,
          onToggle: vi.fn(),
          activeLabel: "Show active",
          deletedLabel: "Show deleted",
        }}
      />,
    );
    expect(viewingDeleted).toContain("Show active");

    const noTrash = renderToStaticMarkup(
      <WorkListFiltersScaffold
        {...baseProps}
        trashToggle={{
          canViewDeleted: false,
          viewingDeleted: false,
          onToggle: vi.fn(),
          activeLabel: "x",
          deletedLabel: "Show deleted",
        }}
      />,
    );
    expect(noTrash).not.toContain("Show deleted");
  });

  it("renders children alongside the toolbar", () => {
    const html = renderToStaticMarkup(
      <WorkListFiltersScaffold {...baseProps}>12 records</WorkListFiltersScaffold>,
    );
    expect(html).toContain("12 records");
  });
});
