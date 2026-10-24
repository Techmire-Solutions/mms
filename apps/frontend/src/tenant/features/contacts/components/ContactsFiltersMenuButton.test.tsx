import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsFiltersMenuButton } from "./ContactsFiltersMenuButton";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AppTranslationKey, ContactsQuickFilter } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockT: TranslationFunction = ((key: AppTranslationKey) => {
  const map: Partial<Record<AppTranslationKey, string>> = {
    "contacts.filters": "Filters",
    "contacts.genderFilter": "Gender",
    "contacts.sortBy": "Sort By",
    "contacts.allGenders": "All Genders",
    "contacts.gender.male": "Male",
    "contacts.gender.female": "Female",
    "contacts.filtersAll": "All Contacts",
    "contacts.filtersWhatsApp": "Has WhatsApp",
    "contacts.filtersSyed": "Is Syed",
    "contacts.filtersMissingInfo": "Missing Info",
    "contacts.filtersRecent": "Recently Added",
  };
  return map[key] ?? key;
}) as unknown as TranslationFunction;

describe("ContactsFiltersMenuButton Component", () => {
  it("renders filter dropdown trigger with idle state when activeFilterCount is 0", () => {
    const html = renderToStaticMarkup(
      <ContactsFiltersMenuButton
        activeFilterCount={0}
        quickFilter="all"
        onQuickFilterChange={vi.fn()}
        filterGender=""
        genders={["male", "female"]}
        onGenderChange={vi.fn()}
        sortField="name"
        sortOptions={[
          { field: "name", label: "Name" },
          { field: "createdAt", label: "Recently Added" },
        ]}
        onSort={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("Filters");
    expect(html).not.toContain("font-bold");
  });

  it("renders active filter badge counter when activeFilterCount > 0", () => {
    const html = renderToStaticMarkup(
      <ContactsFiltersMenuButton
        activeFilterCount={3}
        quickFilter={"whatsapp" as ContactsQuickFilter}
        onQuickFilterChange={vi.fn()}
        filterGender="female"
        genders={["male", "female"]}
        onGenderChange={vi.fn()}
        sortField="createdAt"
        sortOptions={[
          { field: "name", label: "Name" },
          { field: "createdAt", label: "Recently Added" },
        ]}
        onSort={vi.fn()}
        t={mockT}
      />,
    );

    expect(html).toContain("Filters");
    expect(html).toContain("3");
  });

  it("renders correctly within interactive client root", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ContactsFiltersMenuButton
          activeFilterCount={1}
          quickFilter={"syed" as ContactsQuickFilter}
          onQuickFilterChange={vi.fn()}
          filterGender="male"
          genders={["male", "female"]}
          onGenderChange={vi.fn()}
          sortField="name"
          sortOptions={[{ field: "name", label: "Name" }]}
          onSort={vi.fn()}
          t={mockT}
        />,
      );
    });

    expect(container.textContent).toContain("Filters");
    expect(container.textContent).toContain("1");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
