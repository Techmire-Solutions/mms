import { describe, expect, it } from "vitest";
import type { Contact, FieldDefinition } from "./contactTypes.js";
import {
  collectUniqueContactFieldValues,
  findContactUniqueFieldConflicts,
  listUniqueContactFieldRefs,
  normalizeUniqueContactFieldValue,
} from "./contactUniqueFieldValidation.js";

function field(partial: Partial<FieldDefinition> & { key: string }): FieldDefinition {
  return {
    label: partial.key,
    type: "text",
    enabled: true,
    order: 0,
    required: false,
    permissions: [],
    defaultValue: "",
    ...partial,
  };
}

const fields = {
  phones: [
    field({ key: "label" }),
    field({
      key: "number",
      unique: true,
      label: "Phone Number",
      labelKey: "contacts.fields.phoneNumber",
    }),
  ],
  emails: [field({ key: "address", unique: true, type: "email", label: "Email Address" })],
  basic: [field({ key: "cnic", unique: true, label: "CNIC" }), field({ key: "firstName" })],
};

describe("listUniqueContactFieldRefs", () => {
  it("returns only enabled unique fields", () => {
    const refs = listUniqueContactFieldRefs({
      ...fields,
      basic: [...fields.basic, field({ key: "hiddenUnique", unique: true, enabled: false })],
    });
    expect(refs.map((ref) => `${ref.tabId}.${ref.fieldKey}`).sort()).toEqual([
      "basic.cnic",
      "emails.address",
      "phones.number",
    ]);
  });
});

describe("normalizeUniqueContactFieldValue", () => {
  it("normalizes phones to digit-only E.164", () => {
    expect(
      normalizeUniqueContactFieldValue("phones", "number", "03001234567", {
        defaultPhoneCountryCode: "+92",
        row: { countryCode: "+92" },
      }),
    ).toBe("923001234567");
    expect(
      normalizeUniqueContactFieldValue("phones", "number", "+92 300 1234567", {
        row: { countryCode: "+92" },
      }),
    ).toBe("923001234567");
  });

  it("lowercases emails", () => {
    expect(normalizeUniqueContactFieldValue("emails", "address", "  A@B.COM ")).toBe("a@b.com");
  });

  it("normalizes cnic to digits only", () => {
    expect(normalizeUniqueContactFieldValue("basic", "cnic", "42101-1234567-1")).toBe(
      "4210112345671",
    );
    expect(normalizeUniqueContactFieldValue("basic", "cnic", "42101 1234567 1")).toBe(
      "4210112345671",
    );
    expect(normalizeUniqueContactFieldValue("basic", "cnic", "4210112345671")).toBe(
      "4210112345671",
    );
  });
});

describe("findContactUniqueFieldConflicts", () => {
  it("flags duplicate phones across contacts", () => {
    const candidate: Partial<Contact> = {
      id: "c2",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
    };
    const peers: Contact[] = [
      {
        id: "c1",
        firstName: "Ali",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      } as Contact,
    ];

    const errors = findContactUniqueFieldConflicts(candidate, peers, fields, "en", {
      defaultPhoneCountryCode: "+92",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      tabId: "phones",
      fieldId: "number",
      index: 0,
    });
    expect(errors[0].message.toLowerCase()).toContain("unique");
  });

  it("allows the same phone on the same contact being edited", () => {
    const candidate: Partial<Contact> = {
      id: "c1",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
    };
    const peers: Contact[] = [
      {
        id: "c1",
        firstName: "Ali",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      } as Contact,
    ];

    expect(
      findContactUniqueFieldConflicts(candidate, peers, fields, "en", {
        defaultPhoneCountryCode: "+92",
      }),
    ).toEqual([]);
  });

  it("flags duplicate emails and cnic", () => {
    const candidate: Partial<Contact> = {
      id: "c2",
      cnic: "12345-1234567-1",
      emails: [{ label: "Work", address: "Same@Example.com" }],
    };
    const peers: Contact[] = [
      {
        id: "c1",
        firstName: "Ali",
        cnic: "12345-1234567-1",
        emails: [{ label: "Personal", address: "same@example.com" }],
      } as Contact,
    ];

    const errors = findContactUniqueFieldConflicts(candidate, peers, fields, "en");
    expect(errors.map((error) => `${error.tabId}.${error.fieldId}`).sort()).toEqual([
      "basic.cnic",
      "emails.address",
    ]);
  });

  it("flags duplicate cnic across contacts regardless of hyphens or spaces", () => {
    const candidate: Partial<Contact> = {
      id: "c2",
      cnic: "4210112345671",
    };
    const peers: Contact[] = [
      {
        id: "c1",
        firstName: "Ali",
        cnic: "42101-1234567-1",
      } as Contact,
    ];

    const errors = findContactUniqueFieldConflicts(candidate, peers, fields, "en");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      tabId: "basic",
      fieldId: "cnic",
    });
  });

  it("flags duplicate emails within the same contact", () => {
    const candidate: Partial<Contact> = {
      id: "c1",
      emails: [
        { label: "Personal", address: "user@example.com" },
        { label: "Work", address: "USER@EXAMPLE.COM" },
      ],
    };

    const errors = findContactUniqueFieldConflicts(candidate, [], fields, "en");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      tabId: "emails",
      fieldId: "address",
      index: 1,
    });
  });

  it("flags duplicate phones within the same contact", () => {
    const candidate: Partial<Contact> = {
      id: "c1",
      phones: [
        { label: "Mobile", number: "3001111111", countryCode: "+92" },
        { label: "Work", number: "03001111111", countryCode: "+92" },
      ],
    };

    const errors = findContactUniqueFieldConflicts(candidate, [], fields, "en", {
      defaultPhoneCountryCode: "+92",
    });
    expect(errors.some((error) => error.tabId === "phones" && error.index === 1)).toBe(true);
  });

  it("ignores soft-deleted peers", () => {
    const candidate: Partial<Contact> = {
      id: "c2",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
    };
    const peers: Contact[] = [
      {
        id: "c1",
        firstName: "Ali",
        deletedAt: "2026-01-01",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      } as Contact,
    ];

    expect(
      findContactUniqueFieldConflicts(candidate, peers, fields, "en", {
        defaultPhoneCountryCode: "+92",
      }),
    ).toEqual([]);
  });
});

describe("collectUniqueContactFieldValues", () => {
  it("collects only unique-marked values", () => {
    const values = collectUniqueContactFieldValues(
      {
        cnic: "111",
        firstName: "Ali",
        phones: [{ label: "Mobile", number: "300", countryCode: "+92" }],
        emails: [{ label: "Work", address: "a@b.com" }],
      },
      listUniqueContactFieldRefs(fields),
      { defaultPhoneCountryCode: "+92" },
    );
    expect(values.map((value) => value.fieldKey).sort()).toEqual(["address", "cnic", "number"]);
  });
});
