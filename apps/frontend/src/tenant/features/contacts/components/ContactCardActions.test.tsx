import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactCardActions } from "./ContactCardActions";

vi.mock("@/tenant/features/contacts/components/ContactsRowActions", () => ({
  ContactsRowActions: () => <div data-testid="row-actions">row-actions</div>,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

describe("ContactCardActions Component", () => {
  it("renders card view button and row actions", () => {
    const html = renderToStaticMarkup(
      <ContactCardActions
        contact={mockContact}
        displayName="Zayd Harith"
        showArchived={false}
        canWrite={true}
        canDelete={true}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.actionViewShort");
    expect(html).toContain("row-actions");
  });
});
