import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFLICTS_KEY,
  OUTBOX_KEY,
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
    writeJson(CONFLICTS_KEY, [conflictFixture("a"), conflictFixture("b")]);
  });

  it("removes only the requested conflict", () => {
    dismissContactsSyncConflict("a");
    expect(getContactsSyncConflicts().map((c) => c.id)).toEqual(["b"]);
  });

  it("clears all conflicts and leaves the outbox intact", () => {
    writeJson(OUTBOX_KEY, [conflictFixture("outbox", "update")]);
    clearContactsSyncConflicts();
    expect(getContactsSyncConflicts()).toEqual([]);
    expect(getContactsOutbox()).toHaveLength(1);
  });
});

describe("requeueContactsSyncConflict", () => {
  beforeEach(() => {
    localStorage.clear();
    writeJson(CONFLICTS_KEY, [conflictFixture("a", "upsert"), conflictFixture("b", "delete")]);
  });

  it("moves the conflict to the outbox without failedAt and removes it from conflicts", () => {
    requeueContactsSyncConflict("a");
    const outbox = getContactsOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ id: "a", kind: "upsert" });
    expect(outbox[0]).not.toHaveProperty("failedAt");
    expect(getContactsSyncConflicts().map((c) => c.id)).toEqual(["b"]);
  });

  it("is a no-op for unknown ids", () => {
    requeueContactsSyncConflict("nope");
    expect(getContactsOutbox()).toEqual([]);
    expect(getContactsSyncConflicts()).toHaveLength(2);
  });

  it("requeueAll returns the conflict count and empties conflicts", () => {
    const count = requeueAllContactsSyncConflicts();
    expect(count).toBe(2);
    expect(getContactsOutbox()).toHaveLength(2);
    expect(getContactsSyncConflicts()).toEqual([]);
  });
});
