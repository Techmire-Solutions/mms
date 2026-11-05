import { beforeEach, describe, expect, it } from "vitest";
import {
  currentContactsSyncKeys,
  getContactsOutbox,
  getContactsSyncConflicts,
  writeJson,
  type ContactsOutboxEntry,
  type ContactsSyncConflict,
} from "@/lib/contacts/contactsSyncOutboxStorage";
import {
  clearContactsSyncConflicts,
  dismissContactsSyncConflict,
  recordContactsSyncConflict,
  requeueAllContactsSyncConflicts,
  requeueContactsSyncConflict,
} from "@/lib/contacts/contactsSyncOutboxConflicts";

function conflictFixture(
  id: string,
  kind: ContactsOutboxEntry["kind"] = "upsert",
): ContactsSyncConflict {
  return {
    id,
    kind,
    contact: { id: 1 },
    createdAt: "2026-01-01T00:00:00.000Z",
    failedAt: "2026-01-02T00:00:00.000Z",
  } as ContactsSyncConflict;
}

describe("recordContactsSyncConflict", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a conflict with a failedAt timestamp", () => {
    const entry: ContactsOutboxEntry = {
      id: "c1",
      kind: "delete",
      contactId: "7",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    recordContactsSyncConflict(entry);
    const conflicts = getContactsSyncConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ id: "c1", kind: "delete", contactId: "7" });
    expect(typeof conflicts[0]?.failedAt).toBe("string");
    expect(conflicts[0]?.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("dismissContactsSyncConflict / clearContactsSyncConflicts", () => {
  beforeEach(() => {
    localStorage.clear();
    writeJson(currentContactsSyncKeys().conflicts, [conflictFixture("a"), conflictFixture("b")]);
  });

  it("removes only the requested conflict", () => {
    dismissContactsSyncConflict("a");
    expect(getContactsSyncConflicts().map((c) => c.id)).toEqual(["b"]);
  });

  it("clears all conflicts and leaves the outbox intact", () => {
    writeJson(currentContactsSyncKeys().outbox, [conflictFixture("outbox", "update")]);
    clearContactsSyncConflicts();
    expect(getContactsSyncConflicts()).toEqual([]);
    expect(getContactsOutbox()).toHaveLength(1);
  });
});

describe("requeueContactsSyncConflict", () => {
  beforeEach(() => {
    localStorage.clear();
    writeJson(currentContactsSyncKeys().conflicts, [
      conflictFixture("a", "upsert"),
      conflictFixture("b", "delete"),
    ]);
  });

  it("moves the conflict to the outbox without failedAt and removes it from conflicts", () => {
    requeueContactsSyncConflict("a");
    const outbox = getContactsOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ id: "a", kind: "upsert" });
    expect(outbox[0]).not.toHaveProperty("failedAt");
    expect(getContactsSyncConflicts().map((c) => c.id)).toEqual(["b"]);
  });

  it("rebases the local payload onto the fresh server version and counts the attempt", () => {
    requeueContactsSyncConflict("a", {
      id: 1,
      updatedAt: "2026-02-02T00:00:00.000Z",
    } as never);

    const [entry] = getContactsOutbox();
    expect(entry).toMatchObject({
      id: "a",
      kind: "upsert",
      // Without the rebase the replay re-sends the stale token and 409s forever.
      contact: { id: 1, updatedAt: "2026-02-02T00:00:00.000Z" },
      attempts: 1,
    });
  });

  it("is a no-op for unknown ids", () => {
    requeueContactsSyncConflict("nope");
    expect(getContactsOutbox()).toEqual([]);
    expect(getContactsSyncConflicts()).toHaveLength(2);
  });

  it("requeueAll re-queues resolvable conflicts and empties them", async () => {
    const result = await requeueAllContactsSyncConflicts();
    expect(result).toEqual({ requeued: 2, skipped: 0, needsReview: 0 });
    expect(getContactsOutbox()).toHaveLength(2);
    expect(getContactsSyncConflicts()).toEqual([]);
  });

  it("skips conflicts that already exhausted the retry budget", async () => {
    writeJson(currentContactsSyncKeys().conflicts, [
      { ...conflictFixture("a", "upsert"), attempts: 3 },
    ]);

    const result = await requeueAllContactsSyncConflicts();

    expect(result).toEqual({ requeued: 0, skipped: 1, needsReview: 0 });
    expect(getContactsOutbox()).toEqual([]);
    expect(getContactsSyncConflicts().map((c) => c.id)).toEqual(["a"]);
  });

  it("rebases a clean contact (same server version) and drops the form's blueprint id", async () => {
    const updatedAt = "2026-01-01T00:00:00.000Z";
    writeJson(currentContactsSyncKeys().conflicts, [
      {
        ...conflictFixture("a", "upsert"),
        contact: { id: 1, updatedAt, _blueprintId: "1" },
      },
    ]);

    const result = await requeueAllContactsSyncConflicts({
      fetchFresh: async () => ({ id: 1, updatedAt }) as never,
    });

    const [entry] = getContactsOutbox();
    expect(result).toEqual({ requeued: 1, skipped: 0, needsReview: 0 });
    expect(entry).toMatchObject({ kind: "upsert", contact: { id: 1, updatedAt } });
    expect((entry as { contact: Record<string, unknown> }).contact).not.toHaveProperty(
      "_blueprintId",
    );
  });

  it("leaves a conflict with newer server data for individual review", async () => {
    writeJson(currentContactsSyncKeys().conflicts, [
      {
        ...conflictFixture("a", "update"),
        contact: { id: 1, updatedAt: "2026-01-01T00:00:00.000Z", notes: "local edit" },
      },
    ]);

    const result = await requeueAllContactsSyncConflicts({
      fetchFresh: async () =>
        ({ id: 1, updatedAt: "2026-02-02T00:00:00.000Z", notes: "server edit" }) as never,
    });

    expect(result).toEqual({ requeued: 0, skipped: 0, needsReview: 1 });
    expect(getContactsOutbox()).toEqual([]);
    expect(getContactsSyncConflicts().map((conflict) => conflict.id)).toEqual(["a"]);
  });

  it("skips a conflict when the fresh server record cannot be loaded", async () => {
    writeJson(currentContactsSyncKeys().conflicts, [{ ...conflictFixture("a", "update") }]);

    const result = await requeueAllContactsSyncConflicts({
      fetchFresh: async () => null,
    });

    expect(result).toEqual({ requeued: 0, skipped: 1, needsReview: 0 });
    expect(getContactsOutbox()).toEqual([]);
    expect(getContactsSyncConflicts()).toHaveLength(1);
  });
});
