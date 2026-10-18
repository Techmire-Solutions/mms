import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import {
  buildInitialContactDraft,
  buildOptionDefaults,
  contactDraftSnapshot,
} from "@/tenant/features/contacts/hooks/contactFormDraftUtils";

describe("contactDraftSnapshot", () => {
  it("strips blank phone rows and enforces a single primary", () => {
    const snapshot = contactDraftSnapshot({
      phones: [
        { number: "", isPrimary: false },
        { number: "3001234567", isPrimary: false },
      ],
    } as Partial<Contact>);
    const parsed = JSON.parse(snapshot) as { phones: { number: string; isPrimary: boolean }[] };
    expect(parsed.phones).toHaveLength(1);
    expect(parsed.phones[0]).toEqual({ number: "3001234567", isPrimary: true });
  });

  it("strips blank custom-collection rows", () => {
    const snapshot = contactDraftSnapshot({
      customCars: [{ brand: "" }, { brand: "Toyota" }],
    } as Partial<Contact>);
    const parsed = JSON.parse(snapshot) as { customCars: { brand: string }[] };
    expect(parsed.customCars).toEqual([{ brand: "Toyota" }]);
  });
});

describe("buildOptionDefaults", () => {
  it("uses the first of each option list", () => {
    expect(
      buildOptionDefaults({
        phoneLabels: ["Mobile", "Home"],
        emailLabels: ["Personal"],
        addressLabels: ["Home"],
        socialPlatforms: ["Facebook"],
        relationshipOptions: ["Parent"],
        defaultPhoneCountryCode: "+92",
      }),
    ).toEqual({
      phoneLabel: "Mobile",
      emailLabel: "Personal",
      addressLabel: "Home",
      socialPlatform: "Facebook",
      relationship: "Parent",
      defaultPhoneCountryCode: "+92",
    });
  });

  it("falls back gracefully when relationship options are empty", () => {
    expect(
      buildOptionDefaults({
        phoneLabels: [],
        emailLabels: [],
        addressLabels: [],
        socialPlatforms: [],
        relationshipOptions: [],
        defaultPhoneCountryCode: "+1",
      }),
    ).toEqual({
      phoneLabel: undefined,
      emailLabel: undefined,
      addressLabel: undefined,
      socialPlatform: undefined,
      relationship: "",
      defaultPhoneCountryCode: "+1",
    });
  });
});

describe("buildInitialContactDraft", () => {
  const optionDefaults = buildOptionDefaults({
    phoneLabels: ["Mobile"],
    emailLabels: ["Personal"],
    addressLabels: ["Home"],
    socialPlatforms: ["Facebook"],
    relationshipOptions: ["Parent"],
    defaultPhoneCountryCode: "+92",
  });

  it("normalizes a fresh draft with empty rows", () => {
    const draft = buildInitialContactDraft({
      contact: undefined,
      initialDraft: undefined,
      defaultCity: "Lahore",
      defaultProvince: "Punjab",
      defaultCountry: "PK",
      optionDefaults,
      socialPlatforms: ["Facebook"],
      relationshipOptions: ["Parent"],
    });
    expect(Array.isArray(draft.phones)).toBe(true);
    expect(draft.socials).toEqual([{ platform: "Facebook", url: "" }]);
    expect(draft.relationshipContacts).toEqual([{ relationship: "Parent", contactId: "" }]);
  });

  it("preserves existing populated socials and relationships without inserting blanks", () => {
    const draft = buildInitialContactDraft({
      contact: {
        id: 10,
        firstName: "Fatima",
        socials: [{ platform: "LinkedIn", url: "https://linkedin.com/in/fatima" }],
        relationshipContacts: [{ relationship: "Guardian", contactId: "c_999" }],
      } as unknown as Contact,
      initialDraft: undefined,
      defaultCity: "",
      defaultProvince: "",
      defaultCountry: "",
      optionDefaults,
      socialPlatforms: ["Facebook"],
      relationshipOptions: ["Parent"],
    });
    expect(draft.socials).toEqual([
      { platform: "LinkedIn", url: "https://linkedin.com/in/fatima" },
    ]);
    expect(draft.relationshipContacts).toEqual([{ relationship: "Guardian", contactId: "c_999" }]);
  });

  it("does not apply scalar defaults when editing an existing contact", () => {
    const draft = buildInitialContactDraft({
      contact: { id: 5, name: "Existing" } as unknown as Contact,
      initialDraft: undefined,
      defaultCity: "",
      defaultProvince: "",
      defaultCountry: "",
      optionDefaults,
      socialPlatforms: ["Facebook"],
      relationshipOptions: ["Parent"],
    });
    expect(draft.id).toBe(5);
    expect(draft.nickname).toBeUndefined();
  });
});
