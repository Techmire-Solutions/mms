import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { renderContactTableCell } from "./ContactTableCells";

vi.mock("@/tenant/features/contacts/components/contactTablePrimaryCells", () => ({
  renderContactNameCell: () => <div data-testid="name-cell">Name Cell</div>,
  renderContactPhoneCell: () => <div data-testid="phone-cell">Phone Cell</div>,
  renderContactEmailCell: () => <div data-testid="email-cell">Email Cell</div>,
}));

vi.mock("@/tenant/features/contacts/components/ContactMetadataCell", () => ({
  ContactMetadataCell: ({ colId }: { colId: string }) => (
    <div data-testid="meta-cell">Meta: {colId}</div>
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

const baseProps = {
  contact: mockContact,
  displayName: "Zayd Harith",
  getColumnWidth: () => 150,
  prefs: DEFAULT_CONTACT_PREFERENCES,
  countryCodesMap: {},
  countryCodes: [],
  contactsMap: null,
  allContacts: [mockContact],
  showArchived: false,
  isSelected: false,
  t: ((key: string) => key) as never,
};

describe("renderContactTableCell", () => {
  it("dispatches primary cells and metadata cells based on col.id", () => {
    const nameHtml = renderToStaticMarkup(
      renderContactTableCell({
        ...baseProps,
        col: { id: "name", label: "Name" },
      }),
    );
    expect(nameHtml).toContain("Name Cell");

    const phoneHtml = renderToStaticMarkup(
      renderContactTableCell({
        ...baseProps,
        col: { id: "phone", label: "Phone" },
      }),
    );
    expect(phoneHtml).toContain("Phone Cell");

    const emailHtml = renderToStaticMarkup(
      renderContactTableCell({
        ...baseProps,
        col: { id: "email", label: "Email" },
      }),
    );
    expect(emailHtml).toContain("Email Cell");

    const cnicHtml = renderToStaticMarkup(
      renderContactTableCell({
        ...baseProps,
        col: { id: "cnic", label: "CNIC" },
      }),
    );
    expect(cnicHtml).toContain("Meta: cnic");
  });
});
