import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleWorkToolbar } from "./ModuleWorkToolbar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseProps = {
  regionLabel: "Contacts filters",
  search: "",
  onSearchChange: vi.fn(),
  searchPlaceholder: "Search contacts...",
  searchId: "contacts-work-search",
};

const trashToggle = {
  canViewDeleted: true,
  viewingDeleted: false,
  onToggle: vi.fn(),
  activeLabel: "Show Active",
  deletedLabel: "Show Deleted",
};

describe("ModuleWorkToolbar", () => {
  it("renders the labelled region, search field, and `/` shortcut hint", () => {
    const html = renderToStaticMarkup(<ModuleWorkToolbar {...baseProps} />);

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Contacts filters"');
    expect(html).toContain('placeholder="Search contacts..."');
    expect(html).toContain("<kbd");
    expect(html).toContain('aria-keyshortcuts="/"');
  });

  it("suppresses the shortcut hint when the consumer has no shortcut handler", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkToolbar {...baseProps} searchShortcutHint={false} />,
    );

    expect(html).not.toContain("<kbd");
    expect(html).not.toContain("aria-keyshortcuts");
  });

  it("suppresses the shortcut hint when no search id is provided", () => {
    const { searchId: _searchId, ...withoutId } = baseProps;
    const html = renderToStaticMarkup(<ModuleWorkToolbar {...withoutId} />);

    expect(html).not.toContain("<kbd");
    expect(html).not.toContain("aria-keyshortcuts");
  });

  it("announces the shown count only when a label is supplied", () => {
    const withoutCount = renderToStaticMarkup(<ModuleWorkToolbar {...baseProps} />);
    expect(withoutCount).not.toContain('role="status"');

    const withCount = renderToStaticMarkup(
      <ModuleWorkToolbar {...baseProps} shownCountLabel="Showing 42 contacts" />,
    );
    expect(withCount).toContain('role="status"');
    expect(withCount).toContain("Showing 42 contacts");
  });

  it("renders the toolbar slots in contract order", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkToolbar
        {...baseProps}
        hasActiveFilters
        onClearFilters={vi.fn()}
        clearFiltersLabel="Clear filters"
        filterButton={
          <button type="button" data-testid="filter-btn">
            Filters
          </button>
        }
        primaryAction={
          <button type="button" data-testid="primary-btn">
            Create
          </button>
        }
        trashToggle={trashToggle}
        viewModeToggle={{ viewMode: "table", onViewModeChange: vi.fn() }}
      >
        <button type="button" data-testid="child-btn">
          Export
        </button>
      </ModuleWorkToolbar>,
    );

    const order = [
      html.indexOf('data-testid="child-btn"'),
      html.indexOf('data-testid="filter-btn"'),
      html.indexOf("Clear filters"),
      html.indexOf('data-testid="primary-btn"'),
      html.indexOf("Show Deleted"),
      html.indexOf("common.viewMode.group"),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it("renders the divider only when both the filter and layout groups exist", () => {
    const layoutOnly = renderToStaticMarkup(
      <ModuleWorkToolbar
        {...baseProps}
        viewModeToggle={{ viewMode: "table", onViewModeChange: vi.fn() }}
      />,
    );
    expect(layoutOnly).not.toContain("w-px");

    const both = renderToStaticMarkup(
      <ModuleWorkToolbar
        {...baseProps}
        filterButton={<button type="button">Filters</button>}
        viewModeToggle={{ viewMode: "table", onViewModeChange: vi.fn() }}
      />,
    );
    expect(both).toContain("w-px");
  });

  it("hides the primary action and swaps the trash label in trash mode", () => {
    const html = renderToStaticMarkup(
      <ModuleWorkToolbar
        {...baseProps}
        primaryAction={
          <button type="button" data-testid="primary-btn">
            Create
          </button>
        }
        trashToggle={{ ...trashToggle, viewingDeleted: true }}
        viewModeToggle={{ viewMode: "table", onViewModeChange: vi.fn() }}
      />,
    );

    expect(html).not.toContain('data-testid="primary-btn"');
    expect(html).toContain("Show Active");
    expect(html).not.toContain("Show Deleted");
  });

  it("keeps children in trash unless showExportInTrash is false", () => {
    const kept = renderToStaticMarkup(
      <ModuleWorkToolbar {...baseProps} trashToggle={{ ...trashToggle, viewingDeleted: true }}>
        <button type="button" data-testid="export-cta">
          Export CSV
        </button>
      </ModuleWorkToolbar>,
    );
    expect(kept).toContain('data-testid="export-cta"');

    const hidden = renderToStaticMarkup(
      <ModuleWorkToolbar
        {...baseProps}
        showExportInTrash={false}
        trashToggle={{ ...trashToggle, viewingDeleted: true }}
      >
        <button type="button" data-testid="export-cta">
          Export CSV
        </button>
      </ModuleWorkToolbar>,
    );
    expect(hidden).not.toContain('data-testid="export-cta"');
  });

  it("renders the card surface by default and a chrome-less surface when nested", () => {
    const card = renderToStaticMarkup(<ModuleWorkToolbar {...baseProps} />);
    expect(card).toContain("rounded-2xl");

    const plain = renderToStaticMarkup(<ModuleWorkToolbar {...baseProps} surface="plain" />);
    expect(plain).not.toContain("rounded-2xl");
  });
});
