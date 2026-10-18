import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsListFilters } from "./ContactsListFilters";

vi.mock("@/tenant/features/contacts/hooks/useContactsToolbarModel", () => ({
  useContactsToolbarModel: () => ({
    t: (key: string) => key,
    genders: [],
    sortOptions: [],
    columnRegistry: [],
    updateUserColumnLayout: vi.fn(),
    handleResetColumnLayout: vi.fn(),
    columnCustomizerLabels: {} as never,
  }),
}));

vi.mock("@/components/app/ModuleWorkToolbar", () => ({
  ModuleWorkToolbar: ({
    searchPlaceholder,
    filterButton,
  }: {
    searchPlaceholder: string;
    filterButton: React.ReactNode;
  }) => (
    <div data-testid="work-toolbar">
      <input placeholder={searchPlaceholder} />
      <div>{filterButton}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/contacts/components/ContactsFiltersMenuButton", () => ({
  ContactsFiltersMenuButton: () => <button data-testid="filters-menu">Filters</button>,
}));

describe("ContactsListFilters Component", () => {
  it("renders work toolbar with search input and filters menu button", () => {
    const html = renderToStaticMarkup(
      <ContactsListFilters
        search=""
        onSearchChange={vi.fn()}
        filterGender="all"
        onGenderChange={vi.fn()}
        quickFilter="all"
        onQuickFilterChange={vi.fn()}
        sortField="name"
        onSort={vi.fn()}
        hasActiveFilters={false}
        activeFilterCount={0}
        onClearFilters={vi.fn()}
        viewMode="table"
        onViewModeChange={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.searchPlaceholder");
    expect(html).toContain("filters-menu");
  });
});
