import { describe, expect, it } from "vitest";
import {
  CONTACTS_QUICK_FILTER_OPTIONS,
  CONTACTS_QUICK_FILTERS,
  contactsListQuerySchema,
  filterContactsForQuery,
  isContactsQuickFilter,
} from "../contactsListQuery.js";
import type { Contact } from "../contactTypes.js";

function contact(partial: Partial<Contact> & Pick<Contact, "id" | "name">): Contact {
  return {
    firstName: "",
    lastName: "",
    ...partial,
  } as Contact;
}

describe("contactsListQuerySchema", () => {
  it("rejects an invalid quick filter", () => {
    expect(contactsListQuerySchema.safeParse({ quickFilter: "unknown" }).success).toBe(false);
  });

  it("exposes filter menu options aligned with the schema enum", () => {
    expect(CONTACTS_QUICK_FILTER_OPTIONS.map((option) => option.id)).toEqual([
      ...CONTACTS_QUICK_FILTERS,
    ]);
    for (const option of CONTACTS_QUICK_FILTER_OPTIONS) {
      expect(contactsListQuerySchema.safeParse({ quickFilter: option.id }).success).toBe(true);
    }
  });

  it("narrows valid quick-filter strings", () => {
    expect(isContactsQuickFilter("whatsapp")).toBe(true);
    expect(isContactsQuickFilter("unknown")).toBe(false);
  });

  it("transforms comma-separated exclusions", () => {
    expect(
      contactsListQuerySchema.parse({
        excludeIds: " 1, 2, ,3 ",
        excludeLinkedModules: "students,unknown,faculty",
      }),
    ).toMatchObject({
      excludeIds: ["1", "2", "3"],
      excludeLinkedModules: ["students", "faculty"],
    });
  });

  it("transforms boolean query flags", () => {
    expect(
      contactsListQuerySchema.parse({
        hasPhone: "true",
        hasEmail: "true",
        hasReachable: "false",
      }),
    ).toMatchObject({
      hasPhone: true,
      hasEmail: true,
      hasReachable: false,
    });
  });
});

describe("filterContactsForQuery gender", () => {
  const rows = [
    contact({ id: "1", name: "John Doe", gender: "Male" }),
    contact({ id: "2", name: "Jane Doe", gender: "female" }),
    contact({ id: "3", name: "Alex", gender: "male" }),
    contact({ id: "4", name: "Sam", gender: "" }),
    contact({ id: "5", name: "Pat", gender: "unspecified" }),
  ];

  it("matches gender case-insensitively", () => {
    const male = filterContactsForQuery(rows, { gender: "male" });
    expect(male.map((row) => row.id).sort()).toEqual(["1", "3"]);

    const female = filterContactsForQuery(rows, { gender: "Female" });
    expect(female.map((row) => row.id)).toEqual(["2"]);
  });

  it("treats empty gender as unspecified", () => {
    expect(
      filterContactsForQuery(rows, { gender: "unspecified" })
        .map((row) => row.id)
        .sort(),
    ).toEqual(["4", "5"]);
  });
});

describe("filterContactsForQuery hasReachable", () => {
  const rows = [
    contact({
      id: "1",
      name: "Phone",
      phones: [{ label: "Mobile", number: "+15551234567" }],
    }),
    contact({
      id: "2",
      name: "Email",
      emails: [{ label: "Personal", address: "a@example.com" }],
    }),
    contact({ id: "3", name: "Neither", phones: [], emails: [] }),
  ];

  it("keeps contacts with phone or email", () => {
    expect(
      filterContactsForQuery(rows, { hasReachable: true })
        .map((row) => row.id)
        .sort(),
    ).toEqual(["1", "2"]);
  });

  it("filters hasPhone and hasEmail separately", () => {
    expect(filterContactsForQuery(rows, { hasPhone: true }).map((row) => row.id)).toEqual(["1"]);
    expect(filterContactsForQuery(rows, { hasEmail: true }).map((row) => row.id)).toEqual(["2"]);
  });
});

describe("filterContactsForQuery quickFilter", () => {
  const rows = [
    contact({
      id: "1",
      name: "Wa Syed",
      isSyed: true,
      phones: [{ label: "Mobile", number: "+923001111111" }],
      emails: [{ label: "Personal", address: "a@example.com" }],
    }),
    contact({
      id: "2",
      name: "Missing Both",
      phones: [],
      emails: [],
    }),
    contact({
      id: "3",
      name: "Phone Only",
      phones: [{ label: "Mobile", number: "+15551234567" }],
      emails: [],
    }),
  ];

  it("filters whatsapp / syed / missingInfo presets", () => {
    expect(
      filterContactsForQuery(rows, { quickFilter: "whatsapp" })
        .map((row) => row.id)
        .sort(),
    ).toEqual(["1", "3"]);
    expect(filterContactsForQuery(rows, { quickFilter: "syed" }).map((row) => row.id)).toEqual([
      "1",
    ]);
    expect(
      filterContactsForQuery(rows, { quickFilter: "missingInfo" })
        .map((row) => row.id)
        .sort(),
    ).toEqual(["2", "3"]);
  });

  it("filters recent (created in last 30 days)", () => {
    const now = new Date();
    const recentIso = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const oldIso = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const recentRows = [
      contact({ id: "new", name: "New", createdAt: recentIso }),
      contact({ id: "old", name: "Old", createdAt: oldIso }),
    ];
    expect(
      filterContactsForQuery(recentRows, { quickFilter: "recent" }).map((row) => row.id),
    ).toEqual(["new"]);
  });
});

describe("filterContactsForQuery excludeIds", () => {
  const rows = [
    contact({ id: "1", name: "Ali" }),
    contact({ id: "2", name: "Sara" }),
    contact({ id: "3", name: "Hassan" }),
  ];

  it("omits excluded contact ids", () => {
    expect(filterContactsForQuery(rows, { excludeIds: ["2", 3] }).map((row) => row.id)).toEqual([
      "1",
    ]);
  });
});

describe("filterContactsForQuery includeIds", () => {
  const rows = [
    contact({ id: "1", name: "Ali" }),
    contact({ id: "2", name: "Sara" }),
    contact({ id: "3", name: "Hassan" }),
  ];

  it("keeps only included contact ids", () => {
    expect(filterContactsForQuery(rows, { includeIds: ["2", 3] }).map((row) => row.id)).toEqual([
      "2",
      "3",
    ]);
  });

  it("returns none when includeIds is empty", () => {
    expect(filterContactsForQuery(rows, { includeIds: [] })).toEqual([]);
  });
});

describe("filterContactsForQuery soft deletion", () => {
  const rows = [
    contact({ id: "active", name: "Active Contact" }),
    contact({
      id: "deleted",
      name: "Deleted Contact",
      deletedAt: "2026-07-27T00:00:00.000Z",
    }),
  ];

  it("returns active contacts by default and deleted contacts for trash queries", () => {
    expect(filterContactsForQuery(rows, {}).map((row) => row.id)).toEqual(["active"]);
    expect(filterContactsForQuery(rows, { includeDeleted: true }).map((row) => row.id)).toEqual([
      "deleted",
    ]);
  });

  it("safely handles null and undefined inputs", () => {
    expect(filterContactsForQuery(null, {})).toEqual([]);
    expect(filterContactsForQuery(undefined, {})).toEqual([]);
    expect(filterContactsForQuery(rows, null)).toEqual([]);
  });
});
