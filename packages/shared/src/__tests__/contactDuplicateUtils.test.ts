import { describe, expect, it } from "vitest";
import {
  findContactDuplicatePairs,
  getContactDuplicateCandidateKeys,
} from "../contacts/contactDuplicateUtils.js";
import { buildNamePrefixRegex, getEmails } from "../contacts/contactDisplayUtils.js";
import { getPhoneNumbers } from "../core/phoneUtils.js";
import type { Contact } from "../contacts/contactTypes.js";

function contact(id: string, name: string, phone?: string, email?: string): Contact {
  return {
    id,
    name,
    firstName: name,
    phones: phone ? [{ label: "mobile", number: phone }] : [],
    emails: email ? [{ label: "personal", address: email }] : [],
  };
}

describe("buildNamePrefixRegex", () => {
  it("builds an anchored alternation from normalized prefixes", () => {
    expect(buildNamePrefixRegex(["syed", "syeda"])).toBe("^(syed|syeda)\\s+");
  });

  it("normalizes case and trims each prefix", () => {
    expect(buildNamePrefixRegex([" Syed ", "SYEDA"])).toBe("^(syed|syeda)\\s+");
  });

  it("dedupes repeated prefixes", () => {
    expect(buildNamePrefixRegex(["syed", "syed"])).toBe("^(syed)\\s+");
  });

  it("escapes regex metacharacters", () => {
    expect(buildNamePrefixRegex(["a.b"])).toBe("^(a\\.b)\\s+");
  });

  it("returns an empty pattern when nothing to ignore", () => {
    expect(buildNamePrefixRegex([])).toBe("");
    expect(buildNamePrefixRegex(["  "])).toBe("");
  });
});

describe("getContactDuplicateCandidateKeys", () => {
  it("returns normalized phones, emails, and prefix-stripped name", () => {
    const keys = getContactDuplicateCandidateKeys(
      contact("1", "Syed Ahmed", "+92 300-1234567", "Ali@Example.COM"),
      { namePrefixesToIgnore: ["syed"] },
    );
    expect(keys).toEqual({
      phones: ["3001234567"],
      emails: ["ali@example.com"],
      name: "ahmed",
      cnic: "",
    });
  });

  it("extracts scalar phone and email as candidate keys and handles null safely", () => {
    const scalarContact: Contact = {
      id: "scalar-1",
      name: "Usman",
      phone: "+92 300 9876543",
      email: "Usman@Example.com",
    } as Contact;
    const keys = getContactDuplicateCandidateKeys(scalarContact, {});
    expect(keys.phones).toEqual(["3009876543"]);
    expect(keys.emails).toEqual(["usman@example.com"]);

    expect(getPhoneNumbers(null)).toEqual([]);
    expect(getPhoneNumbers(undefined)).toEqual([]);
    expect(getEmails(null)).toEqual([]);
    expect(getEmails(undefined)).toEqual([]);
  });

  it("collapses internal whitespace in name keys", () => {
    const keys = getContactDuplicateCandidateKeys(contact("1", "Ali  Khan"), {});
    expect(keys.name).toBe("alikhan");
  });

  it("matches pair-finder results for prefix-stripped names", () => {
    const prefixed = contact("1", "Syed Ahmed", "+923001111111");
    const plain = contact("2", "Ahmed", "+923001111111");
    const prefs = { namePrefixesToIgnore: ["syed", "syeda"] };

    const keysPrefixed = getContactDuplicateCandidateKeys(prefixed, prefs);
    const keysPlain = getContactDuplicateCandidateKeys(plain, prefs);
    expect(keysPrefixed.name).toBe(keysPlain.name);

    const pairs = findContactDuplicatePairs([prefixed, plain], prefs);
    expect(pairs.some((p) => p.reasonKey === "namePhone")).toBe(true);
  });
});

describe("findContactDuplicatePairs (indexed)", () => {
  it("finds phone matches", () => {
    const pairs = findContactDuplicatePairs([
      contact("1", "Ali", "+923001111111"),
      contact("2", "Ali Khan", "+923001111111"),
      contact("3", "Sara", "+923002222222"),
    ]);
    expect(pairs.some((p) => p.reasonKey === "namePhone" || p.reasonKey === "phone")).toBe(true);
  });

  it("finds email-only matches", () => {
    const pairs = findContactDuplicatePairs([
      contact("1", "A", undefined, "a@test.com"),
      contact("2", "B", undefined, "a@test.com"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasonKey).toBe("email");
  });

  it("finds CNIC matches with high confidence", () => {
    const c1: Contact = { ...contact("1", "Ali Khan"), cnic: "42101-1234567-1" };
    const c2: Contact = { ...contact("2", "Muhammad Ali"), cnic: "4210112345671" };
    const pairs = findContactDuplicatePairs([c1, c2]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasonKey).toBe("cnic");
    expect(pairs[0]?.confidence).toBe(99);
  });

  it("finds CNIC + Name matches with 100% confidence", () => {
    const c1: Contact = { ...contact("1", "Ali Khan"), cnic: "42101-1234567-1" };
    const c2: Contact = { ...contact("2", "Ali Khan"), cnic: "4210112345671" };
    const pairs = findContactDuplicatePairs([c1, c2]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasonKey).toBe("cnicName");
    expect(pairs[0]?.confidence).toBe(100);
  });
});

describe("mergeContacts", () => {
  it("merges basic properties, arrays, activities, attachments, and union of tags", async () => {
    const { mergeContacts } = await import("../contacts/contactMergeUtils.js");
    const keep: Contact = {
      id: "c-1",
      name: "Ali Khan",
      firstName: "Ali",
      lastName: "Khan",
      gender: "male",
      tags: ["Alumni"],
      phones: [{ label: "mobile", number: "+923001234567" }],
      emails: [{ label: "personal", address: "ali@example.com" }],
      activities: [{ id: "act-1", type: "note", content: "Note from keep", date: "2026-01-01" }],
      attachments: [
        {
          id: "att-1",
          name: "id_card.pdf",
          type: "application/pdf",
          size: 1024,
          url: "/uploads/id.pdf",
          date: "2026-01-01",
        },
      ],
    };

    const other: Contact = {
      id: "c-2",
      name: "Ali K",
      firstName: "Ali",
      city: "Karachi",
      dob: "1995-05-15",
      tags: ["VIP", "Alumni"],
      phones: [
        { label: "home", number: "+923001234567" },
        { label: "work", number: "+923009876543" },
      ],
      emails: [{ label: "work", address: "ali.work@example.com" }],
      activities: [
        { id: "act-2", type: "note", content: "Admissions interview note", date: "2026-02-01" },
      ],
      attachments: [
        {
          id: "att-2",
          name: "transcript.pdf",
          type: "application/pdf",
          size: 2048,
          url: "/uploads/transcript.pdf",
          date: "2026-02-01",
        },
      ],
    };

    const merged = mergeContacts(keep, other);

    expect(merged.id).toBe("c-1");
    expect(merged.firstName).toBe("Ali");
    expect(merged.lastName).toBe("Khan");
    expect(merged.city).toBe("Karachi");
    expect(merged.dob).toBe("1995-05-15");
    expect(merged.tags).toEqual(["Alumni", "VIP"]);
    expect(merged.tag).toBe("Alumni, VIP");

    expect(merged.phones).toHaveLength(2);
    expect(merged.emails).toHaveLength(2);

    expect(merged.activities).toHaveLength(2);
    expect(merged.activities?.map((a) => a.content)).toEqual([
      "Note from keep",
      "Admissions interview note",
    ]);

    expect(merged.attachments).toHaveLength(2);
    expect(merged.attachments?.map((a) => a.name)).toEqual(["id_card.pdf", "transcript.pdf"]);
  });
});
