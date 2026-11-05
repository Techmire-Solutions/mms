import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import {
  APPLE_IDENTITY_MATCH_CHUNK_SIZE,
  dedupeAppleImportPreview,
  filterAppleImportFreshContacts,
  matchAppleImportIdentity,
} from "./appleContactsIdentity";

describe("filterAppleImportFreshContacts", () => {
  it("skips preview rows that match existing phones or emails", () => {
    const preview: Contact[] = [
      {
        id: "1",
        name: "A",
        firstName: "A",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      },
      {
        id: "2",
        name: "B",
        firstName: "B",
        emails: [{ label: "Home", address: "b@example.com" }],
      },
      {
        id: "3",
        name: "C Only",
        firstName: "C",
        lastName: "Only",
      },
    ];

    const fresh = filterAppleImportFreshContacts(preview, {
      phones: ["3001234567"],
      emails: ["b@example.com"],
      names: ["c only"],
    });

    expect(fresh).toEqual([]);
  });

  it("keeps rows with no matching identity", () => {
    const preview: Contact[] = [
      {
        id: "1",
        name: "Fresh",
        firstName: "Fresh",
        phones: [{ label: "Mobile", number: "3009998877", countryCode: "+92" }],
      },
    ];

    const fresh = filterAppleImportFreshContacts(preview, {
      phones: ["3001234567"],
      emails: [],
      names: [],
    });

    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.id).toBe("1");
  });
});

describe("matchAppleImportIdentity", () => {
  it("chunks oversized phone lists instead of sending one 5,000-value body", async () => {
    const phones = Array.from(
      { length: 2_500 },
      (_, index) => `92300${String(index).padStart(7, "0")}`,
    );
    const bodies: Array<{ phones: string[]; emails: string[]; names: string[] }> = [];
    const match = async (body: { phones: string[]; emails: string[]; names: string[] }) => {
      bodies.push(body);
      return {
        phones: body.phones.filter((_, index) => index % 2 === 0),
        emails: [],
        names: [],
      };
    };

    const result = await matchAppleImportIdentity({ phones, emails: [], names: [] }, match);

    expect(bodies).toHaveLength(Math.ceil(phones.length / APPLE_IDENTITY_MATCH_CHUNK_SIZE));
    for (const body of bodies) {
      expect(body.phones.length).toBeLessThanOrEqual(APPLE_IDENTITY_MATCH_CHUNK_SIZE);
    }
    // Every existing key reported by any chunk is preserved in the merged result.
    expect(result.phones).toHaveLength(1_250);
    expect(result.emails).toEqual([]);
    expect(result.names).toEqual([]);
  });

  it("sends one combined request when every list is within the server cap", async () => {
    let calls = 0;
    let received: { phones: string[]; emails: string[]; names: string[] } | null = null;
    const match = async (body: { phones: string[]; emails: string[]; names: string[] }) => {
      calls += 1;
      received = body;
      return {
        phones: body.phones.includes("923001234567") ? ["923001234567"] : [],
        emails: body.emails.includes("a@example.com") ? ["a@example.com"] : [],
        names: body.names.includes("ali khan") ? ["ali khan"] : [],
      };
    };

    const result = await matchAppleImportIdentity(
      { phones: ["923001234567"], emails: ["a@example.com"], names: ["ali khan"] },
      match,
    );

    expect(calls).toBe(1);
    expect(received).toEqual({
      phones: ["923001234567"],
      emails: ["a@example.com"],
      names: ["ali khan"],
    });
    expect(result).toEqual({
      phones: ["923001234567"],
      emails: ["a@example.com"],
      names: ["ali khan"],
    });
  });

  it("makes no request when there are no candidates", async () => {
    let calls = 0;
    const result = await matchAppleImportIdentity(
      { phones: [], emails: [], names: [] },
      async () => {
        calls += 1;
        return { phones: [], emails: [], names: [] };
      },
    );

    expect(calls).toBe(0);
    expect(result).toEqual({ phones: [], emails: [], names: [] });
  });
});

describe("dedupeAppleImportPreview", () => {
  const row = (id: string, overrides: Partial<Contact>): Contact =>
    ({ id, name: id, firstName: id, ...overrides }) as Contact;

  it("keeps the first row when a phone repeats inside the same file", () => {
    const unique = dedupeAppleImportPreview([
      row("a", { phones: [{ label: "mobile", number: "3001234567", countryCode: "+92" }] }),
      row("b", { phones: [{ label: "mobile", number: "3001234567", countryCode: "+92" }] }),
    ]);

    expect(unique.map((contact) => contact.id)).toEqual(["a"]);
  });

  it("dedupes name-only rows but not rows with distinct phones", () => {
    const unique = dedupeAppleImportPreview([
      row("a", { name: "Same Name" }),
      row("b", { name: "Same Name" }),
      row("c", { name: "Other", phones: [{ label: "mobile", number: "3009999999" }] }),
    ]);

    expect(unique.map((contact) => contact.id)).toEqual(["a", "c"]);
  });
});
