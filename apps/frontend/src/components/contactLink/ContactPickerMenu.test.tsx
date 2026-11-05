import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactPickerMenu } from "@/components/contactLink/ContactPickerMenu";

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockMatches: Contact[] = [
  {
    id: "cnt-1",
    name: "Sayyida Fatima",
    firstName: "Sayyida",
    lastName: "Fatima",
    phone: "+1234567890",
    email: "fatima@madrasa.com",
    addresses: [
      {
        line1: "123 Main St",
        city: "Najaf",
        isPrimary: true,
        label: "home",
      },
    ],
    gender: "female",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

describe("ContactPickerMenu Component", () => {
  it("returns null when open=false", () => {
    const html = renderToStaticMarkup(
      <ContactPickerMenu
        open={false}
        menuRef={{ current: null }}
        resolvedId="test-picker"
        label="Select Contact"
        menuStyle={{}}
        matches={mockMatches}
        isSearching={false}
        emptyTitle="No contacts found"
        emptyHint="Try another search term"
        onSelect={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders listbox with contact items and details when open=true", () => {
    const html = renderToStaticMarkup(
      <ContactPickerMenu
        open={true}
        menuRef={{ current: null }}
        resolvedId="test-picker"
        label="Select Contact"
        menuStyle={{}}
        matches={mockMatches}
        isSearching={false}
        emptyTitle="No contacts found"
        emptyHint="Try another search term"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="test-picker-listbox"');
    // A listbox may only contain options/groups: no status/empty chrome inside.
    expect(html).not.toContain('role="status"');
    expect(html).toContain("Sayyida Fatima");
    expect(html).toContain("Najaf");
    expect(html).toContain('aria-selected="false"');
  });

  it("renders loading indicator when searching and matches are empty", () => {
    const html = renderToStaticMarkup(
      <ContactPickerMenu
        open={true}
        menuRef={{ current: null }}
        resolvedId="test-picker"
        label="Select Contact"
        menuStyle={{}}
        matches={[]}
        isSearching={true}
        emptyTitle="No contacts found"
        emptyHint="Try another search term"
        onSelect={vi.fn()}
      />,
    );

    // The popup keeps its accessibility target id, but the non-option content
    // must not be a listbox child (axe `aria-required-children`, critical).
    expect(html).toContain("common.loading");
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="listbox"');
    expect(html).toContain('id="test-picker-listbox"');
  });

  it("renders empty state when not searching and matches are empty", () => {
    const html = renderToStaticMarkup(
      <ContactPickerMenu
        open={true}
        menuRef={{ current: null }}
        resolvedId="test-picker"
        label="Select Contact"
        menuStyle={{}}
        matches={[]}
        isSearching={false}
        emptyTitle="No contacts found"
        emptyHint="Try another search term"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("No contacts found");
    expect(html).toContain("Try another search term");
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="listbox"');
    expect(html).toContain('id="test-picker-listbox"');
  });
});
