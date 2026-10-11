import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { ContactTableRow } from "./ContactTableRow";

vi.mock("@/tenant/features/contacts/components/ContactTableCells", () => ({
  renderContactTableCell: ({ col }: { col: { id: string } }) => (
    <td key={col.id} data-testid={`cell-${col.id}`}>
      Cell-{col.id}
    </td>
  ),
}));

vi.mock("@/tenant/features/contacts/components/ContactsRowActions", () => ({
  ContactsRowActions: () => <div data-testid="row-actions">row-actions</div>,
}));

vi.mock("@/hooks/useListRowMotion", () => ({
  useListRowMotion: () => () => ({}),
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

describe("ContactTableRow Component", () => {
  it("renders table row with checkbox, column cells, and row actions", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ContactTableRow
            contact={mockContact}
            isSelected={false}
            columns={[
              { id: "name", label: "Name" },
              { id: "phone", label: "Phone" },
            ]}
            getColumnWidth={() => 120}
            prefs={DEFAULT_CONTACT_PREFERENCES}
            countryCodesMap={{}}
            countryCodes={[]}
            contactsMap={null}
            allContacts={[mockContact]}
            showArchived={false}
            canWrite={true}
            canDelete={true}
            t={((key: string) => key) as never}
            onSelect={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(html).toContain("Cell-name");
    expect(html).toContain("Cell-phone");
    expect(html).toContain("row-actions");
  });
});
