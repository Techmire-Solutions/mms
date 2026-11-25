import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactPickerSearchInput } from "./ContactPickerSearchInput";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

vi.mock("@/components/contactLink/ContactCreateModal", () => ({
  default: () => null,
}));

vi.mock("@/components/contactLink/ContactPickerMenu", () => ({
  ContactPickerMenu: () => null,
}));

const mockT = vi.fn(((key: string) => key) as TranslationFunction);

describe("ContactPickerSearchInput", () => {
  const baseProps = {
    t: mockT,
    label: "Select Guardian",
    resolvedId: "guardian-picker",
    resolvedName: "guardianId",
    query: "",
    open: false,
    allowCreate: false,
    error: false,
    createActionLabel: "Create Contact",
    menuRef: { current: null as unknown as HTMLDivElement },
    anchorRef: { current: null as unknown as HTMLDivElement },
    menuStyle: {},
    matches: [],
    isSearching: false,
    emptyTitle: "No matches",
    emptyHint: "Try searching something else",
    createOpen: false,
    createQuery: "",
    onQueryChange: vi.fn(),
    onOpen: vi.fn(),
    onClearQuery: vi.fn(),
    onOpenCreate: vi.fn(),
    onCloseDropdown: vi.fn(),
    onSelect: vi.fn(),
    onCloseCreate: vi.fn(),
    onCreated: vi.fn(),
  };

  it("renders accessible combobox with correct attributes", () => {
    const html = renderToStaticMarkup(<ContactPickerSearchInput {...baseProps} />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('id="guardian-picker"');
    expect(html).toContain('aria-invalid="false"');
  });

  it("renders error state with aria-invalid and FieldErrorMessage", () => {
    const html = renderToStaticMarkup(
      <ContactPickerSearchInput
        {...baseProps}
        error={true}
        errorMessage="Please select a valid contact"
      />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="guardian-picker-error"');
    expect(html).toContain('id="guardian-picker-error"');
    expect(html).toContain("Please select a valid contact");
  });
});
