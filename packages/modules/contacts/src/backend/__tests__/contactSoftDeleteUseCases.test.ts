import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import type { ContactsRepository } from "../repository/index.js";
import { bulkSoftDeleteContacts, softDeleteContactById } from "../use-cases/index.js";

const mockBroadcastCollection = vi.hoisted(() => vi.fn());

vi.mock("@mms/be-core/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/http")>()),
  getRequestTenant: () => "demo",
}));
vi.mock("@mms/db/client", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runInTransaction: (cb: () => unknown) => cb(),
}));
vi.mock("@mms/be-core/realtime", () => ({ broadcastCollection: mockBroadcastCollection }));
vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
  sanitizeAuditState: (value: unknown) => value,
}));
vi.mock("../use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../repository/contactsRepositoryAdapter.js", () => ({ contactsRepository: {} }));

const LINKED = "Cannot delete contact linked to active student profiles.";

function createRepo(ids: string[], blockedIds: string[] = []) {
  const store = new Map<string, Contact>(
    ids.map((id) => [id, { id, name: `Contact ${id}`, firstName: "Contact" } as Contact]),
  );
  const repo = {
    findByIds: vi.fn(async (_tenant: string, wanted: string[]) =>
      wanted.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
    ),
    bulkSave: vi.fn(async (_tenant: string, rows: Contact[]) => {
      for (const row of rows) store.set(String(row.id), row);
    }),
    findDeleteBlockers: vi.fn(async (_tenant: string, wanted: string[]) =>
      wanted
        .filter((id) => blockedIds.includes(id))
        .map((contactId) => ({ contactId, message: LINKED })),
    ),
    guardDeleteDependents: vi.fn(async (_tenant: string, wanted: string[]) => {
      if (wanted.some((id) => blockedIds.includes(id))) {
        throw Object.assign(new Error(LINKED), { statusCode: 409 });
      }
    }),
  };
  return { store, repo: repo as unknown as ContactsRepository & typeof repo };
}

describe("contact soft delete use cases", () => {
  beforeEach(() => mockBroadcastCollection.mockReset());

  it("bulk delete archives the unlinked rows and reports linked ones as blocked", async () => {
    const { store, repo } = createRepo(["parent", "free-1", "free-2"], ["parent"]);

    const result = await bulkSoftDeleteContacts(
      ["parent", "free-1", "free-2"],
      "u-admin",
      undefined,
      repo,
    );

    expect(result).toEqual({
      succeeded: 2,
      failed: 1,
      blocked: [{ id: "parent", message: LINKED }],
    });
    expect(store.get("parent")?.deletedAt).toBeUndefined();
    expect(store.get("free-1")?.deletedAt).toBeTruthy();
    expect(store.get("free-2")?.deletedAt).toBeTruthy();
    // One linked parent no longer 409s the whole batch.
    expect(repo.guardDeleteDependents).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
  });

  it("bulk delete writes nothing when every row is blocked", async () => {
    const { store, repo } = createRepo(["parent"], ["parent"]);

    const result = await bulkSoftDeleteContacts(["parent"], "u-admin", undefined, repo);

    expect(result).toEqual({
      succeeded: 0,
      failed: 1,
      blocked: [{ id: "parent", message: LINKED }],
    });
    expect(store.get("parent")?.deletedAt).toBeUndefined();
    expect(repo.bulkSave).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).not.toHaveBeenCalled();
  });

  it("bulk delete keeps the plain result shape when nothing is blocked", async () => {
    const { repo } = createRepo(["a", "b"]);

    await expect(bulkSoftDeleteContacts(["a", "b"], "u-admin", undefined, repo)).resolves.toEqual({
      succeeded: 2,
      failed: 0,
    });
  });

  it("single delete of a linked contact still rejects with the 409 reason", async () => {
    const { store, repo } = createRepo(["parent"], ["parent"]);

    await expect(softDeleteContactById("parent", "u-admin", undefined, repo)).rejects.toMatchObject(
      {
        statusCode: 409,
        message: LINKED,
      },
    );
    expect(store.get("parent")?.deletedAt).toBeUndefined();
  });

  it("single delete archives an unlinked contact", async () => {
    const { store, repo } = createRepo(["free"]);

    await expect(softDeleteContactById("free", "u-admin", "Duplicate", repo)).resolves.toBe(true);
    expect(store.get("free")?.deletionReason).toBe("Duplicate");
  });
});
