import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";

const mockLoadContactsByIdsForTenant = vi.fn();

vi.mock("../contacts/use-cases/contactUseCases.js", () => ({
  contactUseCases: {
    loadContactsByIdsForTenant: (...args: unknown[]) => mockLoadContactsByIdsForTenant(...args),
    loadContactsSummaryByIdsForTenant: (...args: unknown[]) =>
      mockLoadContactsByIdsForTenant(...args),
  },
}));

import { hydrateStudentsFromContacts } from "../students/use-cases/studentHydrateUseCases.js";

type ContactRow = {
  id: string;
  name?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  email?: string;
  city?: string;
  relationshipContacts?: Array<{
    contactId?: string | number;
    relationship?: string;
    name?: string;
  }>;
};

function fakeStudent(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    contactId: `c-${id}`,
    name: `Student ${id}`,
    status: "active",
    ...overrides,
  };
}

function mockContactStore(contacts: ContactRow[]): void {
  mockLoadContactsByIdsForTenant.mockImplementation(async (_tenant: string, ids: string[]) => {
    const wanted = new Set(ids.map(String));
    return contacts.filter((contact) => wanted.has(String(contact.id)));
  });
}

describe("hydrateStudentsFromContacts", () => {
  beforeEach(() => {
    mockLoadContactsByIdsForTenant.mockReset();
  });

  it("returns [] for empty rows without loading contacts", async () => {
    await expect(hydrateStudentsFromContacts("demo", [])).resolves.toEqual([]);
    expect(mockLoadContactsByIdsForTenant).not.toHaveBeenCalled();
  });

  it("hydrates profile fields from the linked primary contact", async () => {
    mockContactStore([
      {
        id: "c-s1",
        name: "Ahmed Ali",
        gender: "male",
        dob: "2015-06-01",
        phone: "+123456",
        email: "ahmed@example.com",
        city: "Karachi",
      },
    ]);

    const result = await hydrateStudentsFromContacts("demo", [fakeStudent("s1")]);

    expect(result[0]?.name).toBe("Ahmed Ali");
    expect(result[0]?.gender).toBe("male");
    expect(result[0]?.dob).toBe("2015-06-01");
    expect(result[0]?.phone).toBe("+123456");
    expect(result[0]?.email).toBe("ahmed@example.com");
    expect(result[0]?.city).toBe("Karachi");
  });

  it("derives guardian links from relationships and fetches them in a second pass", async () => {
    mockContactStore([
      {
        id: "c-s1",
        name: "Ahmed Ali",
        relationshipContacts: [
          { contactId: "c-father", relationship: "Parent", name: "Ali Hassan" },
          { contactId: "c-guardian", relationship: "Guardian", name: "Uncle Sam" },
        ],
      },
      { id: "c-father", name: "Ali Hassan" },
      { id: "c-guardian", name: "Uncle Sam" },
    ]);

    const result = await hydrateStudentsFromContacts("demo", [fakeStudent("s1")]);

    expect(result[0]?.fatherContactId).toBe("c-father");
    expect(result[0]?.fatherName).toBe("Ali Hassan");
    expect(result[0]?.guardianContactId).toBe("c-guardian");
    expect(result[0]?.guardianName).toBe("Uncle Sam");
    expect(result[0]?.motherContactId).toBeUndefined();

    // First pass loads the primary contact; second pass loads the derived guardian ids.
    const calls = mockLoadContactsByIdsForTenant.mock.calls.map((call) => call[1].sort());
    expect(calls).toEqual([["c-s1"], ["c-father", "c-guardian"]]);
  });

  it("keeps legacy guardian slots when the contact has no relationship links", async () => {
    mockContactStore([
      { id: "c-s1", name: "Ahmed Ali" },
      { id: "c-legacy-father", name: "Legacy Father" },
      { id: "c-legacy-guardian", name: "Legacy Guardian" },
    ]);

    const result = await hydrateStudentsFromContacts("demo", [
      fakeStudent("s1", {
        fatherContactId: "c-legacy-father",
        fatherName: "Legacy Father",
        guardianContactId: "c-legacy-guardian",
        guardianName: "Legacy Guardian",
      }),
    ]);

    expect(result[0]?.fatherContactId).toBe("c-legacy-father");
    expect(result[0]?.fatherName).toBe("Legacy Father");
    expect(result[0]?.guardianContactId).toBe("c-legacy-guardian");
    expect(result[0]?.guardianName).toBe("Legacy Guardian");
    // No second pass needed — the legacy ids were part of the first-pass fetch.
    expect(mockLoadContactsByIdsForTenant).toHaveBeenCalledTimes(1);
    expect(mockLoadContactsByIdsForTenant).toHaveBeenCalledWith(
      "demo",
      expect.arrayContaining(["c-s1", "c-legacy-father", "c-legacy-guardian"]),
    );
  });

  it("batches first-pass ids across rows and reuses them for derivation", async () => {
    mockContactStore([
      { id: "c-s1", name: "Ahmed Ali" },
      { id: "c-s2", name: "Fatima Noor" },
    ]);

    const result = await hydrateStudentsFromContacts("demo", [
      fakeStudent("s1"),
      fakeStudent("s2"),
    ]);

    expect(result.map((row) => row.name)).toEqual(["Ahmed Ali", "Fatima Noor"]);
    expect(mockLoadContactsByIdsForTenant).toHaveBeenCalledTimes(1);
    expect(mockLoadContactsByIdsForTenant).toHaveBeenCalledWith(
      "demo",
      expect.arrayContaining(["c-s1", "c-s2"]),
    );
  });
});
