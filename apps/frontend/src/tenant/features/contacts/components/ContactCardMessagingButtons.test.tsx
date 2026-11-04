import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import {
  ContactCardMessagingButtons,
  hasContactCardFaceChannels,
} from "./ContactCardMessagingButtons";

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
  phones: [{ number: "+1 555-0100", label: "Mobile", isPrimary: true }],
  emails: [{ address: "zayd@example.com", label: "Personal", isPrimary: true }],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactCardMessagingButtons Component", () => {
  it("evaluates hasContactCardFaceChannels correctly", () => {
    expect(
      hasContactCardFaceChannels({
        contact: mockContact,
        phone: "+1 555-0100",
        email: "zayd@example.com",
      }),
    ).toBe(true);

    expect(
      hasContactCardFaceChannels({
        contact: mockContact,
        phone: null,
        email: null,
      }),
    ).toBe(false);

    expect(
      hasContactCardFaceChannels({
        contact: mockContact,
        phone: "+1 555-0100",
        email: null,
        showArchived: true,
      }),
    ).toBe(false);
  });

  it("renders messaging action buttons for phone and email", () => {
    const html = renderToStaticMarkup(
      <ContactCardMessagingButtons
        contact={mockContact}
        displayName="Zayd Harith"
        phone="+1 555-0100"
        email="zayd@example.com"
        onWhatsApp={vi.fn()}
        onSms={vi.fn()}
        onEmail={vi.fn()}
      />,
    );

    expect(html).toContain("tel:+15550100");
  });
});
