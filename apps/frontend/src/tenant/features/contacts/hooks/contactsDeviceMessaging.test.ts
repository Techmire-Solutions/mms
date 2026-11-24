import { afterEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import { buildContactDeviceChannelUri } from "@/tenant/features/contacts/hooks/contactsDeviceMessaging";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c-1",
    firstName: "Ahmad",
    name: "Ahmad Khan",
    phones: [{ label: "Mobile", number: "3001234561", countryCode: "+92", isPrimary: true }],
    emails: [{ label: "Work", address: "ahmad@example.com", isPrimary: true }],
    ...overrides,
  } as Contact;
}

describe("buildContactDeviceChannelUri", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a wa.me link from the primary phone", () => {
    expect(buildContactDeviceChannelUri("whatsapp", contact())).toBe("https://wa.me/923001234561");
  });

  it("builds an sms: link from the primary phone", () => {
    expect(buildContactDeviceChannelUri("sms", contact())).toBe("sms:+923001234561");
  });

  it("builds a mailto: link from the primary email", () => {
    expect(buildContactDeviceChannelUri("email", contact())).toBe("mailto:ahmad@example.com");
  });

  it("returns null when the contact has no address for the channel", () => {
    expect(buildContactDeviceChannelUri("whatsapp", contact({ phones: [] }))).toBeNull();
    expect(buildContactDeviceChannelUri("sms", contact({ phones: [] }))).toBeNull();
    expect(buildContactDeviceChannelUri("email", contact({ emails: [] }))).toBeNull();
  });
});
