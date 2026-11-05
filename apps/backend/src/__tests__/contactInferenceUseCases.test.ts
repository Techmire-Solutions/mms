import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, RelationshipPair } from "@mms/shared";

const mockLoadContactPreferences = vi.fn();

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: () => mockLoadContactPreferences(),
}));

import { applyContactRelationshipInference } from "../contacts/use-cases/contactInferenceUseCases.js";
import { applyContactRelationshipInference as applyInferenceDirect } from "../contacts/use-cases/contactInferenceApply.js";

describe("contact inference apply module", () => {
  it("keeps the direct apply entry point importable", () => {
    expect(typeof applyInferenceDirect).toBe("function");
  });
});

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

  it("never relabels a user-authored relationship as inferred", async () => {
    const { repo, store, bulkSave } = createFakeRepo();
    store.set(
      "c2",
      fakeContact("c2", {
        relationshipContacts: [{ contactId: "c1", relationship: "Ward" }],
      }),
    );
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Parent" }],
    });

    await applyContactRelationshipInference("demo", source, undefined, repo);

    expect(bulkSave).not.toHaveBeenCalled();
    expect(store.get("c2")?.relationshipContacts?.[0]).toEqual({
      contactId: "c1",
      relationship: "Ward",
    });
  });

  it("removes a stale inferred link when the source link is gone", async () => {
    const store = new Map<string, Contact>();
    store.set(
      "c2",
      fakeContact("c2", {
        relationshipContacts: [
          {
            contactId: "c1",
            relationship: "Child",
            inferred: true,
            inferredFromContactId: "c1",
            inferenceDepth: 1,
          },
        ],
      }),
    );
    const bulkSave = vi.fn(async (_tenant: string, contacts: Contact[]) => {
      contacts.forEach((contact) => store.set(String(contact.id), contact));
    });
    const repo = {
      findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
        ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
      ),
      bulkSave,
    } as unknown as Parameters<typeof applyContactRelationshipInference>[3];

    await applyContactRelationshipInference("demo", fakeContact("c1"), undefined, repo, {
      // The link existed before this write; cleanup must remove the stale row.
      previousSource: fakeContact("c1", {
        relationshipContacts: [{ contactId: "c2", relationship: "Parent" }],
      }),
    });

    expect(bulkSave).toHaveBeenCalledOnce();
    expect(store.get("c2")?.relationshipContacts).toEqual([]);
  });

  it("skips a target whose version changed concurrently instead of overwriting it", async () => {
    const store = new Map<string, Contact>();
    store.set("c2", fakeContact("c2", { updatedAt: "2026-01-01T00:00:00.000Z" }));
    const saveIfVersionMatches = vi.fn(async () => null);
    const bulkSave = vi.fn(async () => undefined);
    const repo = {
      findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
        ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
      ),
      saveIfVersionMatches,
      bulkSave,
    } as unknown as Parameters<typeof applyContactRelationshipInference>[3];
    const source = fakeContact("c1", {
      relationshipContacts: [{ contactId: "c2", relationship: "Parent" }],
    });

    await applyContactRelationshipInference("demo", source, undefined, repo);

    expect(saveIfVersionMatches).toHaveBeenCalledOnce();
    expect(bulkSave).not.toHaveBeenCalled();
    expect(store.get("c2")?.relationshipContacts).toEqual([]);
  });
});
