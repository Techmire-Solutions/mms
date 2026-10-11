import { describe, expect, it } from "vitest";
import type { Contact } from "../contactEntityTypes.js";
import {
  deriveSiblingLinks,
  mergeStoredAndDerivedSiblingLinks,
} from "../contactSiblingDerivation.js";

function contact(
  partial: Partial<Contact> & {
    id: string;
    relationshipContacts?: Contact["relationshipContacts"];
    relationships?: Contact["relationships"];
  },
): Contact {
  return {
    firstName: "Test",
    lastName: partial.id,
    name: partial.name ?? `Contact ${partial.id}`,
    ...partial,
  } as Contact;
}

describe("deriveSiblingLinks", () => {
  it("returns mutual siblings when two children share a parent", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
      ],
    });
    const child1 = contact({
      id: "c1",
      gender: "male",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });
    const child2 = contact({
      id: "c2",
      gender: "female",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });
    const all = [parent, child1, child2];

    expect(deriveSiblingLinks(child1, all)).toEqual([
      {
        contactId: "c2",
        relationship: "Sibling",
        derivedSibling: true,
        name: "Contact c2",
        gender: "female",
      },
    ]);
    expect(deriveSiblingLinks(child2, all)).toEqual([
      {
        contactId: "c1",
        relationship: "Sibling",
        derivedSibling: true,
        name: "Contact c1",
        gender: "male",
      },
    ]);
  });

  it("returns both siblings when three children share a parent", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
        { contactId: "c3", relationship: "Child" },
      ],
    });
    const child1 = contact({
      id: "c1",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });
    const child2 = contact({
      id: "c2",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });
    const child3 = contact({
      id: "c3",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });

    expect(
      deriveSiblingLinks(child1, [parent, child1, child2, child3]).map((link) => link.contactId),
    ).toEqual(["c2", "c3"]);
  });

  it("returns empty when there is no shared parent", () => {
    const a = contact({
      id: "a",
      relationshipContacts: [{ contactId: "b", relationship: "Husband" }],
    });
    const b = contact({
      id: "b",
      relationshipContacts: [{ contactId: "a", relationship: "Wife" }],
    });
    expect(deriveSiblingLinks(a, [a, b])).toEqual([]);
  });

  it("finds siblings via Child links on parent alone", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
      ],
    });
    const child1 = contact({ id: "c1", relationshipContacts: [] });
    const child2 = contact({ id: "c2", name: "Sibling Two", relationshipContacts: [] });

    expect(deriveSiblingLinks(child1, [parent, child1, child2])).toEqual([
      {
        contactId: "c2",
        relationship: "Sibling",
        derivedSibling: true,
        name: "Sibling Two",
      },
    ]);
  });
});

describe("mergeStoredAndDerivedSiblingLinks", () => {
  it("preserves derived sibling gender and name", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
      ],
    });
    const child1 = contact({
      id: "c1",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });
    const child2 = contact({
      id: "c2",
      name: "Sister Two",
      gender: "female",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });

    const merged = mergeStoredAndDerivedSiblingLinks(child1, [parent, child1, child2]);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: "p1",
          relationship: "Parent",
        }),
        expect.objectContaining({
          contactId: "c2",
          relationship: "Sibling",
          derivedSibling: true,
          name: "Sister Two",
          gender: "female",
          inferred: true,
        }),
      ]),
    );
  });

  it("dedupes derived siblings against stored relationshipContacts ids", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
      ],
    });
    const child1 = contact({
      id: "c1",
      relationshipContacts: [
        { contactId: "p1", relationship: "Parent" },
        { contactId: "c2", relationship: "Sibling", name: "Already linked" },
      ],
    });
    const child2 = contact({
      id: "c2",
      gender: "female",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });

    const merged = mergeStoredAndDerivedSiblingLinks(child1, [parent, child1, child2]);
    const c2Links = merged.filter((link) => link.contactId === "c2");
    expect(c2Links).toHaveLength(1);
    expect(c2Links[0]).toMatchObject({
      contactId: "c2",
      relationship: "Sibling",
      name: "Already linked",
    });
    expect(c2Links[0]?.derivedSibling).toBeUndefined();
  });

  it("includes legacy relationships ids in dedupe set", () => {
    const parent = contact({
      id: "p1",
      relationshipContacts: [
        { contactId: "c1", relationship: "Child" },
        { contactId: "c2", relationship: "Child" },
      ],
    });
    const child1 = contact({
      id: "c1",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
      relationships: [{ contactId: "c2", relationship: "Sibling" }],
    });
    const child2 = contact({
      id: "c2",
      gender: "female",
      relationshipContacts: [{ contactId: "p1", relationship: "Parent" }],
    });

    const merged = mergeStoredAndDerivedSiblingLinks(child1, [parent, child1, child2]);
    const c2Links = merged.filter((link) => link.contactId === "c2");
    expect(c2Links).toHaveLength(1);
    expect(c2Links[0]?.derivedSibling).toBeUndefined();
    expect(c2Links[0]?.relationship).toBe("Sibling");
  });
});
