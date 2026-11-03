import { describe, expect, it } from "vitest";
import type { Contact } from "./contactEntityTypes.js";
import { parseContactsCsv } from "./contactsCsvParser.js";
import { stripAbsentContactCollections } from "./contactWriteSanitize.js";
import {
  stripUnreadableViewerWriteKeys,
  type ContactFieldConfigSnapshot,
} from "./contactResponseSanitizer.js";

/**
 * Round-4 write guards: an absent collection must never be read as "clear it".
 * These are the shared halves of R4-03 (viewer-hidden tab) and R4-04 (CSV import).
 */
describe("CSV import column presence (R4-04)", () => {
  it("leaves collections undefined when the file has no column for them", () => {
    const csv = ["First Name,Last Name,Gender", "Aisha,Khan,Female"].join("\n");
    const { contacts, errors } = parseContactsCsv(csv);

    expect(errors).toHaveLength(0);
    const [contact] = contacts as Contact[];
    expect(contact?.firstName).toBe("Aisha");
    // Absent columns ⇒ absent keys ⇒ the persist layer keeps the stored rows.
    expect("phones" in (contact as object)).toBe(false);
    expect("emails" in (contact as object)).toBe(false);
    expect("addresses" in (contact as object)).toBe(false);
    expect("bankDetails" in (contact as object)).toBe(false);
  });

  it("still emits a collection when its column is present but empty", () => {
    const csv = ["First Name,Phone Number", "Aisha,"].join("\n");
    const { contacts } = parseContactsCsv(csv);

    const [contact] = contacts as Contact[];
    expect(contact?.phones).toEqual([]);
  });

  it("parses the collection when the column carries a value", () => {
    const csv = ["First Name,Phone Number", "Aisha,3001234567"].join("\n");
    const { contacts } = parseContactsCsv(csv);

    expect((contacts[0] as Contact).phones?.map((phone) => phone.number)).toEqual(["3001234567"]);
  });
});

describe("stripAbsentContactCollections (R4-03)", () => {
  it("drops unseen collections and their scalar mirrors", () => {
    const payload = {
      id: "c1",
      firstName: "Aisha",
      phones: [],
      phone: "",
      emails: [],
      email: "",
      addresses: [],
      line1: "",
      city: "",
      state: "",
      country: "",
    };
    // The loaded record exposes only identity: every collection tab is hidden.
    const source = { id: "c1", firstName: "Aisha" };

    const stripped = stripAbsentContactCollections(payload, source);

    expect(stripped.firstName).toBe("Aisha");
    for (const key of [
      "phones",
      "phone",
      "emails",
      "email",
      "addresses",
      "line1",
      "city",
      "state",
      "country",
    ]) {
      expect(key in stripped).toBe(false);
    }
  });

  it("keeps a collection the source actually carried", () => {
    const payload = { id: "c1", phones: [] };
    const stripped = stripAbsentContactCollections(payload, {
      id: "c1",
      phones: [{ number: "3001234567" }],
    });
    expect(stripped.phones).toEqual([]);
  });

  it("is a no-op for a new contact (no source record)", () => {
    const payload = { firstName: "New", phones: [] };
    expect(stripAbsentContactCollections(payload, undefined)).toEqual(payload);
  });
});

describe("stripUnreadableViewerWriteKeys (R4-03)", () => {
  const snapshot = {
    fields: {},
    tabs: [
      { key: "phones", label: "Phones", order: 1, enabled: false },
      { key: "emails", label: "Emails", order: 2, enabled: true },
    ],
  } as unknown as ContactFieldConfigSnapshot;

  it("never writes a collection whose tab the role cannot read", () => {
    const patch = { id: "c1", phones: [], phone: "", emails: [], email: "a@b.com" };
    const stripped = stripUnreadableViewerWriteKeys(patch, "teacher", snapshot);

    expect("phones" in stripped).toBe(false);
    expect("phone" in stripped).toBe(false);
    // A readable tab is untouched.
    expect(stripped.emails).toEqual([]);
    expect(stripped.email).toBe("a@b.com");
  });

  it("is a no-op when every tab is readable", () => {
    const patch = { phones: [] };
    const open = {
      fields: {},
      tabs: [{ key: "phones", label: "Phones", order: 1, enabled: true }],
    } as unknown as ContactFieldConfigSnapshot;
    expect(stripUnreadableViewerWriteKeys(patch, "admin", open)).toEqual(patch);
  });
});
