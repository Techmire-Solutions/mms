import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ upsertContact: vi.fn() }));

vi.mock("../contacts/use-cases/contactWriteUseCases.js", () => ({
  upsertContact: mocks.upsertContact,
}));

const { createGuardianContact, guardianRelationships, GUARDIAN_RELATIONSHIP } = await import(
  "../enrollments/use-cases/admissionsGuardianLink.js"
);

describe("createGuardianContact", () => {
  beforeEach(() => {
    mocks.upsertContact.mockReset();
    mocks.upsertContact.mockImplementation(
      async (contact: { id: string }) => ({ contact, created: true }),
    );
  });

  it("creates a contact carrying the guardian's name", async () => {
    const id = await createGuardianContact("Abdul Rahman Khan", undefined);
    expect(id).toBeTruthy();
    const [contact] = mocks.upsertContact.mock.calls[0] as [
      { name: string; firstName: string; lastName?: string; phone?: string },
    ];
    expect(contact.name).toBe("Abdul Rahman Khan");
    expect(contact.firstName).toBe("Abdul");
    expect(contact.lastName).toBe("Rahman Khan");
  });

  it("leaves the guardian without a phone, since the application's phone is the applicant's", async () => {
    await createGuardianContact("Abdul Rahman Khan", undefined);
    const [contact] = mocks.upsertContact.mock.calls[0] as [{ phone?: string }];
    expect(contact.phone).toBeUndefined();
  });

  it("handles a single-word name without inventing a surname", async () => {
    await createGuardianContact("Rahman", undefined);
    const [contact] = mocks.upsertContact.mock.calls[0] as [
      { firstName: string; lastName?: string },
    ];
    expect(contact.firstName).toBe("Rahman");
    expect(contact.lastName).toBeUndefined();
  });

  it("returns null for a blank name and creates nothing", async () => {
    expect(await createGuardianContact("   ", undefined)).toBeNull();
    expect(mocks.upsertContact).not.toHaveBeenCalled();
  });
});

describe("guardianRelationships", () => {
  it("links the guardian contact under the guardian relationship label", () => {
    const rows = guardianRelationships("guardian-1", " Abdul Rahman ");
    expect(rows).toEqual([
      { contactId: "guardian-1", name: "Abdul Rahman", relationship: GUARDIAN_RELATIONSHIP },
    ]);
  });

  it("returns undefined when there is no guardian contact to link", () => {
    expect(guardianRelationships(null, "Abdul Rahman")).toBeUndefined();
  });
});
