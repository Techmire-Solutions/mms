import { describe, expect, it } from "vitest";
import type { Contact } from "./contactTypes.js";
import { mergeContacts } from "./contactMergeUtils.js";

const contact = (overrides: Partial<Contact>): Contact =>
  ({
    id: "cnt-1",
    firstName: "Ali",
    lastName: "Khan",
    name: "Ali Khan",
    ...overrides,
  }) as Contact;

describe("mergeContacts — notes", () => {
  it("keeps the removed duplicate's note when the survivor has none", () => {
    const keep = contact({ id: "keep", notes: "" });
    const other = contact({ id: "other", notes: "Met at the intake interview." });

    expect(mergeContacts(keep, other).notes).toBe("Met at the intake interview.");
  });

  it("concatenates distinct notes instead of discarding either one", () => {
    const keep = contact({ id: "keep", notes: "Guardian of student 12." });
    const other = contact({ id: "other", notes: "Prefers Urdu." });

    expect(mergeContacts(keep, other).notes).toBe("Guardian of student 12.\n\nPrefers Urdu.");
  });

  it("does not duplicate an identical note", () => {
    const keep = contact({ id: "keep", notes: "Prefers Urdu." });
    const other = contact({ id: "other", notes: "Prefers Urdu." });

    expect(mergeContacts(keep, other).notes).toBe("Prefers Urdu.");
  });

  it("leaves notes undefined when neither record has one", () => {
    const merged = mergeContacts(contact({ id: "keep" }), contact({ id: "other" }));

    expect(merged.notes).toBeUndefined();
  });
});

describe("mergeContacts — existing collection behaviour stays intact", () => {
  it("unions phones, emails and tags without dropping either record", () => {
    const keep = contact({
      id: "keep",
      phones: [{ number: "+923001234567", label: "mobile" }],
      tags: ["VIP"],
    });
    const other = contact({
      id: "other",
      phones: [
        { number: "+923001234567", label: "mobile" },
        { number: "+923009876543", label: "home" },
      ],
      emails: [{ address: "ali@example.com", label: "personal" }],
      tags: ["Donor"],
    });

    const merged = mergeContacts(keep, other);

    expect(merged.phones?.map((phone) => phone.number)).toEqual(["+923001234567", "+923009876543"]);
    expect(merged.emails?.map((email) => email.address)).toEqual(["ali@example.com"]);
    expect(merged.tags).toEqual(["VIP", "Donor"]);
  });
});
