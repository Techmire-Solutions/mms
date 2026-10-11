import { describe, expect, it } from "vitest";
import { hydrateContactRelationshipFields } from "./contactRelationshipHydrate.js";

describe("hydrateContactRelationshipFields", () => {
  it("keeps modern relationshipContacts and strips legacy key", () => {
    const hydrated = hydrateContactRelationshipFields({
      relationshipContacts: [{ contactId: "a", relationship: "Father" }],
      emergencyContacts: [{ contactId: "b", relationship: "Mother" }],
    } as Record<string, unknown>);
    expect(hydrated.relationshipContacts).toEqual([{ contactId: "a", relationship: "Father" }]);
    expect("emergencyContacts" in hydrated).toBe(false);
  });

  it("copies legacy emergencyContacts when modern is missing", () => {
    const hydrated = hydrateContactRelationshipFields({
      emergencyContacts: [{ contactId: "b", relationship: "Mother" }],
    } as Record<string, unknown>);
    expect(hydrated.relationshipContacts).toEqual([{ contactId: "b", relationship: "Mother" }]);
    expect("emergencyContacts" in hydrated).toBe(false);
  });

  it("keeps an empty modern list instead of resurrecting legacy", () => {
    const hydrated = hydrateContactRelationshipFields({
      relationshipContacts: [],
      emergencyContacts: [{ contactId: "b", relationship: "Mother" }],
    } as Record<string, unknown>);
    expect(hydrated.relationshipContacts).toEqual([]);
    expect("emergencyContacts" in hydrated).toBe(false);
  });
});
