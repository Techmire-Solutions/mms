import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, RelationshipPair } from "@mms/shared";

const mockLoadContactPreferences = vi.fn();

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: () => mockLoadContactPreferences(),
}));

import { applyContactRelationshipInference } from "../contacts/use-cases/contactInferenceUseCases.js";

function fakeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: "Contact",
    lastName: id,
    relationshipContacts: [],
    relationships: [],
    ...overrides,
  };
}

function createFakeRepo() {
  const store = new Map<string, Contact>();
  const findByIds = vi.fn(async (_tenant: string, ids: string[]) =>
    ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
  );
  const bulkSave = vi.fn(async (_tenant: string, contacts: Contact[]) => {
    contacts.forEach((contact) => store.set(String(contact.id), contact));
  });
  return {
    store,
    repo: {
      findByIds,
      bulkSave,
    } as unknown as Parameters<typeof applyContactRelationshipInference>[3],
    bulkSave,
  };
}

describe("applyContactRelationshipInference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContactPreferences.mockResolvedValue(null);
  });

  it("writes a reciprocal inferred link on the target contact", async () => {
    const { repo, store, bulkSave } = createFakeRepo();
    store.set("c2", fakeContact("c2"));
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Parent" }],
    });

    await applyContactRelationshipInference("demo", source, undefined, repo);

    expect(bulkSave).toHaveBeenCalledOnce();
    const saved = bulkSave.mock.calls[0]?.[1]?.[0];
    expect(saved.id).toBe("c2");
    expect(saved.relationshipContacts).toEqual([
      {
        contactId: "c1",
        relationship: "Child",
        inferred: true,
        inferredFromContactId: "c1",
        inferenceDepth: 1,
      },
    ]);
  });

  it("is a no-op when the source has no links", async () => {
    const { repo, bulkSave } = createFakeRepo();
    const source = fakeContact("c1");
    await applyContactRelationshipInference("demo", source, undefined, repo);
    expect(bulkSave).not.toHaveBeenCalled();
  });

  it("is a no-op when the target contact is missing", async () => {
    const { repo, bulkSave } = createFakeRepo();
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "missing", relationship: "Parent" }],
    });
    await applyContactRelationshipInference("demo", source, undefined, repo);
    expect(bulkSave).not.toHaveBeenCalled();
  });

  it("skips targets that are soft-deleted", async () => {
    const { repo, store, bulkSave } = createFakeRepo();
    store.set("c2", fakeContact("c2", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Parent" }],
    });
    await applyContactRelationshipInference("demo", source, undefined, repo);
    expect(bulkSave).not.toHaveBeenCalled();
  });

  it("honors a customPairs override instead of stored preferences", async () => {
    const { repo, store, bulkSave } = createFakeRepo();
    store.set("c2", fakeContact("c2"));
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Boss" }],
    });
    const customPairs: RelationshipPair[] = [{ id: "x", forward: "Boss", inverse: "Employee" }];

    await applyContactRelationshipInference("demo", source, customPairs, repo);

    const saved = bulkSave.mock.calls[0]?.[1]?.[0];
    expect(saved.relationshipContacts?.[0]?.relationship).toBe("Employee");
  });

  it("skips relationships with no reciprocal pair label", async () => {
    const { repo, store, bulkSave } = createFakeRepo();
    store.set("c2", fakeContact("c2"));
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Friend" }],
    });
    await applyContactRelationshipInference("demo", source, undefined, repo);
    expect(bulkSave).not.toHaveBeenCalled();
  });
});
