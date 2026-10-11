import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { ContactCardItem } from "@/tenant/features/contacts/components/ContactCardItem";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `${key}:${params.name}`;
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Sayyida Fatima",
  firstName: "Sayyida",
  lastName: "Fatima",
  gender: "female",
  isSyed: true,
  phone: "+1234567890",
  email: "fatima@madrasa.com",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockDeletedContact: Contact = {
  ...mockContact,
  id: "cnt-2",
  name: "Ali Hassan",
  gender: "male",
  isSyed: false,
  deletedAt: "2024-01-02T00:00:00Z",
};

describe("ContactCardItem", () => {
  it("renders contact card with header, info pills, and action triggers", () => {
    const html = renderToStaticMarkup(
      <ContactCardItem
        contact={mockContact}
        isSelected={false}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        countryCodesMap={{ US: "+1" }}
        countryCodes={[{ country: "US", code: "+1" }]}
        contactsMap={new Map()}
        allContacts={[mockContact]}
        otherColumns={[]}
        isColumnVisible={() => true}
        showArchived={false}
        canWrite={true}
        canDelete={true}
        onSelect={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onWhatsApp={vi.fn()}
        onSms={vi.fn()}
        onEmail={vi.fn()}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).toContain("fatima@madrasa.com");
    expect(html).toContain("Female");
    expect(html).toContain("contacts.table.yesSyed");
  });

  it("renders archived banner when viewing deleted contacts", () => {
    const html = renderToStaticMarkup(
      <ContactCardItem
        contact={mockDeletedContact}
        isSelected={false}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        countryCodesMap={{ US: "+1" }}
        countryCodes={[{ country: "US", code: "+1" }]}
        contactsMap={new Map()}
        allContacts={[mockDeletedContact]}
        otherColumns={[]}
        isColumnVisible={() => true}
        showArchived={true}
        canWrite={true}
        canDelete={true}
        onSelect={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("contacts.detail.archivedBanner");
  });

  it("respects isColumnVisible by omitting gender and syed when hidden", () => {
    const html = renderToStaticMarkup(
      <ContactCardItem
        contact={mockContact}
        isSelected={false}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        countryCodesMap={{ US: "+1" }}
        countryCodes={[{ country: "US", code: "+1" }]}
        contactsMap={new Map()}
        allContacts={[mockContact]}
        otherColumns={[]}
        isColumnVisible={(key) => key !== "gender" && key !== "isSyed" && key !== "syed"}
        showArchived={false}
        canWrite={true}
        canDelete={true}
        onSelect={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("Sayyida Fatima");
    expect(html).not.toContain("contacts.table.yesSyed");
    expect(html).not.toContain("Female");
  });

  it("marks checkbox as checked when isSelected is true", () => {
    const html = renderToStaticMarkup(
      <ContactCardItem
        contact={mockContact}
        isSelected={true}
        prefs={DEFAULT_CONTACT_PREFERENCES}
        countryCodesMap={{ US: "+1" }}
        countryCodes={[{ country: "US", code: "+1" }]}
        contactsMap={new Map()}
        allContacts={[mockContact]}
        otherColumns={[]}
        isColumnVisible={() => true}
        showArchived={false}
        canWrite={true}
        canDelete={true}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain('aria-checked="true"');
  });
});
