import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { ContactsListCards } from "./ContactsListCards";

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: DEFAULT_CONTACT_PREFERENCES,
    countryCodesMap: {},
    countryCodes: [],
    columnRegistry: [],
    isColumnVisible: () => true,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDescriptorCalls = vi.fn();

vi.mock("@/tenant/features/contacts/hooks/useContactEntityDescriptor", () => ({
  useContactEntityDescriptor: () => {
    mockDescriptorCalls();
    return { entityType: "contacts", fields: [], cardSlots: {} };
  },
}));

vi.mock("@/tenant/features/contacts/components/ContactCardItem", () => ({
  ContactCardItem: ({
    contact,
    descriptor,
  }: {
    contact: { name: string };
    descriptor: unknown;
  }) => (
    <div data-testid="contact-card-item" data-has-descriptor={String(Boolean(descriptor))}>
      {contact.name}
    </div>
  ),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactsListCards Component", () => {
  it("renders card item for each contact", () => {
    const html = renderToStaticMarkup(
      <ContactsListCards
        contacts={[mockContact]}
        selected={[]}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("contact-card-item");
    expect(html).toContain("Zayd Harith");
  });

  it("resolves one descriptor for the whole directory and shares it with every card", () => {
    mockDescriptorCalls.mockClear();
    const cards: Contact[] = [
      mockContact,
      { ...mockContact, id: "cnt-2", name: "Second Card" },
      { ...mockContact, id: "cnt-3", name: "Third Card" },
    ];

    const html = renderToStaticMarkup(
      <ContactsListCards
        contacts={cards}
        selected={[]}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // One resolution for three cards — the per-card hook was the regression.
    expect(mockDescriptorCalls).toHaveBeenCalledTimes(1);
    expect(html.match(/data-has-descriptor="true"/g)).toHaveLength(3);
  });
});
