import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import { contactToRecipient } from "../lib/messagingWorkPanelShared";

function contactFixture(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-1",
    name: "Aisha Ahmed",
    firstName: "Aisha",
    lastName: "Ahmed",
    ...overrides,
  };
}

describe("contactToRecipient", () => {
  it("maps phones and emails via display/primary getters", () => {
    const contact = contactFixture({
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
      emails: [{ label: "Work", address: "aisha@example.com", isPrimary: true }],
    });

    expect(contactToRecipient(contact)).toEqual({
      id: "contact-1",
      name: "Aisha Ahmed",
      phone: "+92 3001234567",
      email: "aisha@example.com",
    });
  });

  it("uses empty strings when phone and email are missing", () => {
    expect(contactToRecipient(contactFixture())).toEqual({
      id: "contact-1",
      name: "Aisha Ahmed",
      phone: "",
      email: "",
    });
  });
});
