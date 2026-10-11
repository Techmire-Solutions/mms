import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  OUTBOX_KEY,
  CONFLICTS_KEY,
  writeJson,
  getContactsOutbox,
  getContactsSyncConflicts,
  notifyContactsSyncOutboxChanged,
} from "@/lib/contacts/contactsSyncOutboxStorage";

describe("contactsSyncOutboxStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("getContactsOutbox returns empty array when nothing stored", () => {
    expect(getContactsOutbox()).toEqual([]);
  });

  it("getContactsOutbox returns stored entries", () => {
    const entry = { id: "1", kind: "upsert", contact: { id: "c1" }, createdAt: "now" };
    writeJson(OUTBOX_KEY, [entry]);
    expect(getContactsOutbox()).toEqual([entry]);
  });

  it("getContactsOutbox falls back to empty on malformed JSON", () => {
    localStorage.setItem(OUTBOX_KEY, "not-json");
    expect(getContactsOutbox()).toEqual([]);
  });

  it("getContactsSyncConflicts returns stored conflicts", () => {
    const conflict = {
      id: "1",
      kind: "delete",
      contactId: "c1",
      createdAt: "now",
      failedAt: "later",
    };
    writeJson(CONFLICTS_KEY, [conflict]);
    expect(getContactsSyncConflicts()).toEqual([conflict]);
  });

  it("notifyContactsSyncOutboxChanged dispatches the custom event", () => {
    const listener = vi.fn();
    window.addEventListener("contacts-sync-outbox-changed", listener);
    notifyContactsSyncOutboxChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("contacts-sync-outbox-changed", listener);
  });
});
