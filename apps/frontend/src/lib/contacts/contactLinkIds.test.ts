import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import { collectLinkedContactIds, mergeContactLinkDirectory } from "@/lib/contacts/contactLinkIds";

function makeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return { id, name: `Contact ${id}`, firstName: `Contact ${id}`, ...overrides };
}

describe("collectLinkedContactIds", () => {
  it("dedupes ids from relationshipContacts and legacy relationships in order", () => {
    const contacts: Contact[] = [
      makeContact("a", {
        relationshipContacts: [{ contactId: "b" }, { contactId: "b" }, { contactId: "c" }],
        relationships: [{ contactId: "d" }, { contactId: "c" }],
      }),
      makeContact("b", {
        relationshipContacts: [{ contactId: 5 }, { contactId: "c" }],
        relationships: [],
      }),
    ];

    expect(collectLinkedContactIds(contacts)).toEqual(["b", "c", "d", "5"]);
  });

  it("skips null and empty ids", () => {
    const contacts: Contact[] = [
      makeContact("a", {
        relationshipContacts: [{ contactId: "" }, { contactId: undefined }, { contactId: "b" }],
        relationships: [{ contactId: "" }, { contactId: "c" }],
      }),
    ];

    expect(collectLinkedContactIds(contacts)).toEqual(["b", "c"]);
  });

  it("returns an empty list when no links exist", () => {
    expect(collectLinkedContactIds([makeContact("a")])).toEqual([]);
  });
});

describe("mergeContactLinkDirectory", () => {
  it("lets primary rows win on id collisions and fills missing ids from resolved", () => {
    const primary: Contact[] = [makeContact("a"), makeContact("b")];
    const resolved: Contact[] = [
      makeContact("b", { name: "B-resolved" }),
      makeContact("c"),
      makeContact("a", { name: "A-resolved" }),
    ];

    const merged = mergeContactLinkDirectory(primary, resolved);
    expect(merged.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(merged[0].name).toBe("Contact a");
    expect(merged[1].name).toBe("Contact b");
    expect(merged[2].name).toBe("Contact c");
  });

  it("dedupes resolved rows that repeat an id", () => {
    const resolved: Contact[] = [makeContact("a"), makeContact("a")];
    const merged = mergeContactLinkDirectory([], resolved);
    expect(merged).toHaveLength(1);
  });
});
