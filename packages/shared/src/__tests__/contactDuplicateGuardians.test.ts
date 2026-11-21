import { describe, expect, it } from "vitest";
import { findContactDuplicatePairs } from "../contacts/contactDuplicateUtils.js";
import { collectContactGuardianIds } from "../contacts/contactDuplicateGuardians.js";
import type { Contact, RelationshipContact } from "../contacts/contactTypes.js";

function contact(
  id: string,
  name: string,
  overrides: Partial<Contact> & { relationshipContacts?: RelationshipContact[] } = {},
): Contact {
  return { id, name, firstName: name, ...overrides };
}

describe("findContactDuplicatePairs — exact name matching", () => {
  it("given two contacts with the same name in different case and spacing, should flag a name pair", () => {
    // Arrange
    const pool = [contact("a", "Muhammad  Ali"), contact("b", " muhammad ali ")];

    // Act
    const pairs = findContactDuplicatePairs(pool);

    // Assert
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasonKey).toBe("name");
    expect(pairs[0]?.contacts.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("given different names, should not flag a pair", () => {
    // Arrange
    const pool = [contact("a", "Muhammad Ali"), contact("b", "Muhammad Alia")];

    // Act
    const pairs = findContactDuplicatePairs(pool);

    // Assert
    expect(pairs).toEqual([]);
  });
});

describe("findContactDuplicatePairs — parent with multiple children", () => {
  it("given two same-name guardian contacts each linked from a different child, should not flag the parent name", () => {
    // Arrange
    const pool = [
      contact("g1", "Abdul Rahman"),
      contact("g2", "Abdul Rahman"),
      contact("s1", "Ahmed", {
        relationshipContacts: [{ contactId: "g1", relationship: "guardian" }],
      }),
      contact("s2", "Fatima", {
        relationshipContacts: [{ contactId: "g2", relationship: "Father" }],
      }),
    ];

    // Act
    const pairs = findContactDuplicatePairs(pool);

    // Assert
    expect(pairs).toEqual([]);
  });

  it("given guardian ids supplied from outside the pool, should not flag their name-only pair", () => {
    // Arrange
    const pool = [contact("g1", "Abdul Rahman"), contact("g2", "Abdul Rahman")];

    // Act
    const pairs = findContactDuplicatePairs(pool, {}, { guardianContactIds: ["g1", "g2"] });

    // Assert
    expect(pairs).toEqual([]);
  });

  it("given only one side is a guardian, should still flag the same-name pair", () => {
    // Arrange
    const pool = [contact("g1", "Abdul Rahman"), contact("x", "Abdul Rahman")];

    // Act
    const pairs = findContactDuplicatePairs(pool, {}, { guardianContactIds: ["g1"] });

    // Assert
    expect(pairs.map((p) => p.reasonKey)).toEqual(["name"]);
  });

  it("given two guardians that also share a phone, should still flag them", () => {
    // Arrange
    const phone = [{ label: "mobile", number: "+92 344 2241024" }];
    const pool = [
      contact("g1", "Abdul Rahman", { phones: phone }),
      contact("g2", "Abdul Rahman", { phones: phone }),
    ];

    // Act
    const pairs = findContactDuplicatePairs(pool, {}, { guardianContactIds: ["g1", "g2"] });

    // Assert
    expect(pairs.map((p) => p.reasonKey)).toEqual(["namePhone"]);
  });
});

describe("collectContactGuardianIds", () => {
  it("given a contact with a child link, should mark the owner as a guardian", () => {
    // Arrange
    const parent = contact("p", "Parent", {
      relationshipContacts: [{ contactId: "c", relationship: "Daughter" }],
    });

    // Act
    const ids = collectContactGuardianIds([parent]);

    // Assert
    expect([...ids]).toEqual(["p"]);
  });

  it("given a child linking its parent, should mark the linked contact, not the child", () => {
    // Arrange
    const child = contact("c", "Child", {
      relationshipContacts: [{ contactId: "p", relationship: "Parent" }],
    });

    // Act
    const ids = collectContactGuardianIds([child], [" extra "]);

    // Assert
    expect([...ids].sort()).toEqual(["extra", "p"]);
  });

  it("given unrelated relationship labels or missing ids, should mark nobody", () => {
    // Arrange
    const spouse = contact("h", "Husband", {
      relationshipContacts: [{ contactId: "w", relationship: "Wife" }, { relationship: "Child" }],
    });

    // Act
    const ids = collectContactGuardianIds([spouse]);

    // Assert
    expect(ids.size).toBe(0);
  });
});
