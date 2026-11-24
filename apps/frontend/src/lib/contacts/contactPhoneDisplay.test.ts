import { describe, expect, it } from "vitest";
import type { Contact, ContactPreferences } from "@mms/contracts";
import {
  formatContactPhoneDisplay,
  formatContactPhoneFull,
  formatTelHref,
  getFallbackCountryCode,
  resolveContactPhoneDisplay,
  resolveAllContactPhones,
  resolveAllContactEmails,
} from "@/lib/contacts/contactPhoneDisplay";

describe("formatContactPhoneDisplay", () => {
  it("returns the fallback code and empty number for empty input", () => {
    expect(formatContactPhoneDisplay("", "+92")).toEqual({
      countryCode: "+92",
      formattedNumber: "",
    });
    expect(formatContactPhoneDisplay(null, "+92")).toEqual({
      countryCode: "+92",
      formattedNumber: "",
    });
  });

  it("parses an international number into country code and local part", () => {
    expect(formatContactPhoneDisplay("+1 555 1234", "+92")).toEqual({
      countryCode: "+1",
      formattedNumber: "555 1234",
    });
  });

  it("formats a local number with the fallback country code", () => {
    expect(formatContactPhoneDisplay("3001234567", "+92")).toEqual({
      countryCode: "+92",
      formattedNumber: "3001234567",
    });
  });
});

describe("formatTelHref", () => {
  it("returns '#' for empty input", () => {
    expect(formatTelHref(null)).toBe("#");
    expect(formatTelHref("")).toBe("#");
  });

  it("builds a digit-only tel: href for a +92 number", () => {
    expect(formatTelHref("+92 300 1234567")).toBe("tel:+923001234567");
    expect(formatTelHref("+923001234567")).toBe("tel:+923001234567");
  });
});

describe("formatContactPhoneFull", () => {
  it("formats a local number with the fallback country code", () => {
    expect(formatContactPhoneFull("3001234567", "+92")).toBe("+92 3001234567");
  });

  it("keeps an international number whole", () => {
    expect(formatContactPhoneFull("+1 555 1234")).toBe("+1 555 1234");
  });

  it("falls back to the raw string when input is empty", () => {
    expect(formatContactPhoneFull("", "+92")).toBe("");
    expect(formatContactPhoneFull(null, "+92")).toBe("");
  });
});

describe("getFallbackCountryCode", () => {
  const codesMap: Record<string, string> = { PK: "+92", SA: "+966" };

  it("prefers the mapped default country from prefs", () => {
    expect(getFallbackCountryCode({ defaultCountry: "PK" }, codesMap)).toBe("+92");
  });

  it("falls back to the first configured country code", () => {
    expect(getFallbackCountryCode({}, undefined, [{ country: "Pakistan", code: "+92" }])).toBe(
      "+92",
    );
  });

  it("falls back to the first mapped code when no configured list exists", () => {
    expect(getFallbackCountryCode({}, codesMap)).toBe("+92");
  });

  it("returns empty string when nothing is resolvable", () => {
    expect(getFallbackCountryCode({})).toBe("");
    expect(getFallbackCountryCode({ defaultCountry: "XX" }, {})).toBe("");
  });
});

describe("resolveContactPhoneDisplay", () => {
  it("resolves the primary phone and display via shared formatting", () => {
    const contact: Contact = {
      id: "c1",
      name: "Aisha",
      firstName: "Aisha",
      phones: [
        { label: "Mobile", number: "+923001234567", countryCode: "+92", isPrimary: true },
        { label: "Work", number: "5551234", countryCode: "+1" },
      ],
    };
    expect(resolveContactPhoneDisplay(contact)).toEqual({
      phone: "+92 3001234567",
      countryCode: "+92",
      phoneDisplay: "3001234567",
    });
  });

  it("returns empty display with the fallback country code for an empty contact", () => {
    const contact: Contact = { id: "c2", name: "New", firstName: "New" };
    const prefs: Partial<ContactPreferences> = { defaultCountry: "PK" };
    expect(resolveContactPhoneDisplay(contact, prefs, { PK: "+92" })).toEqual({
      phone: null,
      countryCode: "+92",
      phoneDisplay: "",
    });
  });
});

describe("resolveAllContactPhones", () => {
  it("resolves all phone entries with proper formatting and labels", () => {
    const contact: Contact = {
      id: "c1",
      name: "Ali",
      firstName: "Ali",
      phones: [
        { label: "Mobile", number: "+923001234567", countryCode: "+92", isPrimary: true },
        { label: "Office", number: "+15551234567", countryCode: "+1" },
      ],
    };
    const phones = resolveAllContactPhones(contact);
    expect(phones).toHaveLength(2);
    expect(phones[0]).toEqual({
      phone: "+923001234567",
      countryCode: "+92",
      phoneDisplay: "3001234567",
      label: "Mobile",
      isPrimary: true,
    });
    expect(phones[1]).toEqual({
      phone: "+15551234567",
      countryCode: "+1",
      phoneDisplay: "5551234567",
      label: "Office",
      isPrimary: undefined,
    });
  });

  it("falls back to scalar phone if phones array is missing", () => {
    const contact: Contact = {
      id: "c2",
      name: "Omar",
      firstName: "Omar",
      phone: "+923442241024",
    };
    const phones = resolveAllContactPhones(contact, undefined, { PK: "+92" });
    expect(phones).toHaveLength(1);
    expect(phones[0]?.phone).toBe("+923442241024");
  });
});

describe("resolveAllContactEmails", () => {
  it("resolves all email entries with labels", () => {
    const contact: Contact = {
      id: "c1",
      name: "Ali",
      firstName: "Ali",
      emails: [
        { label: "Personal", address: "ali@gmail.com", isPrimary: true },
        { label: "Work", address: "ali@work.org" },
      ],
    };
    const emails = resolveAllContactEmails(contact);
    expect(emails).toHaveLength(2);
    expect(emails[0]).toEqual({
      email: "ali@gmail.com",
      label: "Personal",
      isPrimary: true,
    });
    expect(emails[1]).toEqual({
      email: "ali@work.org",
      label: "Work",
      isPrimary: undefined,
    });
  });

  it("falls back to scalar email if emails array is missing", () => {
    const contact: Contact = {
      id: "c2",
      name: "Omar",
      firstName: "Omar",
      email: "omar@madrasa.org",
    };
    const emails = resolveAllContactEmails(contact);
    expect(emails).toHaveLength(1);
    expect(emails[0]?.email).toBe("omar@madrasa.org");
  });
});
