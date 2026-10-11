import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppTranslationKey } from "@mms/shared";
import { ContactsListFilters } from "./ContactsListFilters";
import { CONTACTS_WORK_SEARCH_INPUT_ID } from "@/tenant/features/contacts/hooks/useContactsKeyboardShortcuts";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "common.clearSearch": "Clear search",
        "common.searchPlaceholder": "Search...",
        "common.viewMode.group": "View mode",
        "common.viewMode.table": "Table view",
        "common.viewMode.cards": "Cards view",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactsToolbarModel", () => ({
  useContactsToolbarModel: () => ({
    t: (key: AppTranslationKey, params?: Record<string, string | number>) => {
      const map: Partial<Record<AppTranslationKey, string>> = {
        "contacts.shownCount": `Showing ${params?.count ?? 0} contacts`,
        "contacts.searchPlaceholder": "Search contacts by name, phone, email...",
        "contacts.filters": "Filters",
        "contacts.clearFilters": "Clear filters",
        "contacts.showActive": "Show Active",
        "contacts.showDeleted": "Show Deleted",
        "contacts.columns": "Columns",
        "common.clearSearch": "Clear search",
      };
      return map[key] ?? key;
    },
    genders: ["male", "female"],
    sortOptions: [{ field: "name", label: "Name" }],
    columnRegistry: [{ key: "name", label: "Name", enabled: true, order: 0, fixed: true }],
    updateUserColumnLayout: vi.fn(),
    handleResetColumnLayout: vi.fn(),
    columnCustomizerLabels: {
      trigger: "Columns",
      title: "Columns",
      visibleAndOrder: "Visible & Order",
      hidden: "Hidden",
      fixed: "Fixed",
      hideColumn: (label: string) => `Hide ${label}`,
      reset: "Reset",
      searchPlaceholder: "Filter columns...",
    },
  }),
}));

describe("ContactsListFilters Component", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    filterGender: "",
    onGenderChange: vi.fn(),
    quickFilter: "all" as const,
    onQuickFilterChange: vi.fn(),
    sortField: "name",
    onSort: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
    viewMode: "table" as const,
    onViewModeChange: vi.fn(),
  };

  it("renders search input with placeholder, shortcut badge, canonical ID, and accessibility region", () => {
    const html = renderToStaticMarkup(<ContactsListFilters {...defaultProps} />);
    expect(html).toContain("Search contacts by name, phone, email...");
    expect(html).toContain("/");
    expect(html).toContain(`id="${CONTACTS_WORK_SEARCH_INPUT_ID}"`);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Filters"');
  });

  it("renders clear search button when search query is non-empty", () => {
    const emptyHtml = renderToStaticMarkup(<ContactsListFilters {...defaultProps} search="" />);
    expect(emptyHtml).not.toContain("Clear search");

    const filledHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} search="Ahmad" />,
    );
    expect(filledHtml).toContain("Clear search");
  });

  it("renders live polite count announcer when shownCount is supplied", () => {
    const html = renderToStaticMarkup(<ContactsListFilters {...defaultProps} shownCount={42} />);
    expect(html).toContain("Showing 42 contacts");
  });

  it("conditionally renders clear filters button when hasActiveFilters is true", () => {
    const withoutFilterHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} hasActiveFilters={false} />,
    );
    expect(withoutFilterHtml).not.toContain("Clear filters");

    const withFilterHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} hasActiveFilters={true} activeFilterCount={2} />,
    );
    expect(withFilterHtml).toContain("Clear filters");
  });

  it("conditionally renders trash toggle when canViewDeleted and onShowDeletedChange are provided", () => {
    const onShowDeletedChange = vi.fn();
    const withoutTrashHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} canViewDeleted={false} />,
    );
    expect(withoutTrashHtml).not.toContain("Show Deleted");

    const withTrashHtml = renderToStaticMarkup(
      <ContactsListFilters
        {...defaultProps}
        canViewDeleted={true}
        viewingDeleted={false}
        onShowDeletedChange={onShowDeletedChange}
      />,
    );
    expect(withTrashHtml).toContain("Show Deleted");
  });

  it("renders active view mode selection in WorkViewModeToggle", () => {
    const tableHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} viewMode="table" />,
    );
    expect(tableHtml).toContain('aria-pressed="true"');

    const cardsHtml = renderToStaticMarkup(
      <ContactsListFilters {...defaultProps} viewMode="cards" />,
    );
    expect(cardsHtml).toContain('aria-pressed="true"');
  });
});
