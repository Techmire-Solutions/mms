import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import {
  currentContactsSyncKeys,
  getContactsOutbox,
  getContactsSyncConflicts,
  writeJson,
} from "@/lib/contacts/contactsSyncOutboxStorage";
import {
  enqueueContactsOutbox,
  flushContactsOutbox,
  resetContactsOutboxFlushForTests,
} from "@/lib/contacts/contactsSyncOutboxFlush";

function contactFixture(id: number | string): Contact {
  return { id: String(id), name: `Contact ${id}` } as Contact;
}

describe("enqueueContactsOutbox", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("appends a full entry with id and createdAt", () => {
    enqueueContactsOutbox({ id: "e1", kind: "upsert", contact: contactFixture(1) });
    const queue = getContactsOutbox();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: "e1", kind: "upsert" });
    expect(typeof queue[0]?.createdAt).toBe("string");
    expect(queue[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to a generated id when none is provided", () => {
    enqueueContactsOutbox({ kind: "delete", contactId: "9" });
    const queue = getContactsOutbox();
    expect(typeof queue[0]?.id).toBe("string");
    expect(queue[0]?.id.length).toBeGreaterThan(0);
    expect(queue[0]?.kind).toBe("delete");
  });
});

describe("flushContactsOutbox", () => {
  beforeEach(() => {
    localStorage.clear();
    resetContactsOutboxFlushForTests();
  });

  it("invokes the matching handler per entry kind and reports synced counts", async () => {
    writeJson(currentContactsSyncKeys().outbox, [
      {
        id: "e1",
        kind: "upsert",
        contact: contactFixture(1),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        kind: "update",
        contactId: "2",
        contact: contactFixture(2),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e3",
        kind: "delete",
        contactId: "3",
        deletionReason: "Duplicate",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const handlers = {
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const result = await flushContactsOutbox(handlers);

    expect(result).toEqual({ synced: 3, failed: 0, conflicts: 0 });
    expect(handlers.upsert).toHaveBeenCalledWith(contactFixture(1));
    expect(handlers.update).toHaveBeenCalledWith("2", contactFixture(2));
    expect(handlers.delete).toHaveBeenCalledWith("3", "Duplicate");
  });

  it("removes successfully replayed entries from the store", async () => {
    writeJson(currentContactsSyncKeys().outbox, [
      {
        id: "e1",
        kind: "upsert",
        contact: contactFixture(1),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const handlers = {
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    await flushContactsOutbox(handlers);

    expect(getContactsOutbox()).toEqual([]);
  });

  it("records a conflict and increments failed/conflicts when a handler rejects", async () => {
    writeJson(currentContactsSyncKeys().outbox, [
      {
        id: "e1",
        kind: "upsert",
        contact: contactFixture(1),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        kind: "update",
        contactId: "2",
        contact: contactFixture(2),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const handlers = {
      upsert: vi.fn().mockRejectedValue(new Error("offline")),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const result = await flushContactsOutbox(handlers);

    expect(result).toEqual({ synced: 1, failed: 1, conflicts: 1 });
    expect(getContactsOutbox()).toEqual([]);
    const conflicts = getContactsSyncConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ id: "e1", kind: "upsert" });
  });

  it("skips entries already removed from the queue before flush", async () => {
    writeJson(currentContactsSyncKeys().outbox, [
      {
        id: "e1",
        kind: "upsert",
        contact: contactFixture(1),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      { id: "e2", kind: "delete", contactId: "2", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    // Simulate another tab removing e1 before this flush starts.
    writeJson(currentContactsSyncKeys().outbox, [
      { id: "e2", kind: "delete", contactId: "2", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const handlers = {
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const result = await flushContactsOutbox(handlers);

    expect(handlers.upsert).not.toHaveBeenCalled();
    expect(handlers.delete).toHaveBeenCalledWith("2", undefined);
    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
  });

  it("replays the queue once when several mounted hooks flush concurrently", async () => {
    writeJson(currentContactsSyncKeys().outbox, [
      {
        id: "e1",
        kind: "upsert",
        contact: contactFixture(1),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const handlers = {
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    const results = await Promise.all([
      flushContactsOutbox(handlers),
      flushContactsOutbox(handlers),
      flushContactsOutbox(handlers),
    ]);

    expect(handlers.upsert).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { synced: 1, failed: 0, conflicts: 0 },
      { synced: 1, failed: 0, conflicts: 0 },
      { synced: 1, failed: 0, conflicts: 0 },
    ]);
  });
});

describe("contacts outbox storage scoping", () => {
  beforeEach(() => {
    localStorage.clear();
    resetContactsOutboxFlushForTests();
  });

  it("keeps each user's queue isolated on a shared device", () => {
    localStorage.setItem("mms_user", JSON.stringify({ id: "u1" }));
    const userOneKeys = currentContactsSyncKeys();
    enqueueContactsOutbox({ kind: "delete", contactId: "c1" });
    expect(getContactsOutbox()).toHaveLength(1);

    localStorage.setItem("mms_user", JSON.stringify({ id: "u2" }));
    const userTwoKeys = currentContactsSyncKeys();
    expect(userTwoKeys.outbox).not.toBe(userOneKeys.outbox);
    expect(userTwoKeys.outbox).toContain("u:u2");
    expect(getContactsOutbox()).toEqual([]);
  });

  it("falls back to a tenant-scoped key before sign-in", () => {
    const keys = currentContactsSyncKeys();
    expect(keys.outbox).toContain("contacts_sync_outbox");
    expect(keys.outbox).not.toContain("_u:");
  });
});
