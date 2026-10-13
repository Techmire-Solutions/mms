import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { ContactCardMetadataGrid } from "./ContactCardMetadataGrid";

vi.mock("@/tenant/features/contacts/components/ContactMetadataCell", () => ({
  ContactMetadataCell: ({ colId }: { colId: string }) => (
    <div data-testid="meta-cell">Cell: {colId}</div>
  ),
}));

vi.mock("@/tenant/features/contacts/lib/contactCardColumnData", () => ({
  hasContactCardColumnData: () => true,
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  type: "student",
  status: "active",
  cnic: "42101-1234567-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactCardMetadataGrid Component", () => {
  it("renders metadata grid items for visible columns", () => {
    const html = renderToStaticMarkup(
      <ContactCardMetadataGrid
        contact={mockContact}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        allContacts={[mockContact]}
        contactsMap={new Map([[String(mockContact.id), mockContact]])}
        otherColumns={[{ id: "cnic", label: "CNIC" }]}
        isColumnVisible={() => true}
        t={((key: string) => key) as never}
      />,
    );

    expect(html).toContain("CNIC");
    expect(html).toContain("Cell: cnic");
  });

  it("returns null when otherColumns is empty", () => {
    const htmlEmpty = renderToStaticMarkup(
      <ContactCardMetadataGrid
        contact={mockContact}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        allContacts={[mockContact]}
        contactsMap={null}
        otherColumns={[]}
        isColumnVisible={() => true}
        t={((key: string) => key) as never}
      />,
    );

    expect(htmlEmpty).toBe("");
  });
});
