import { beforeEach, describe, expect, it } from "vitest";
import type { Contact } from "@mms/contracts";
import {
  describeContactsOutboxEntry,
  type ContactsOutboxEntry,
} from "@/lib/contacts/contactsSyncOutbox";

function baseEntry(overrides: Partial<ContactsOutboxEntry>): ContactsOutboxEntry {
  return {
    id: "entry-1",
    kind: "upsert",
    contact: { id: 1 },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as ContactsOutboxEntry;
}

describe("describeContactsOutboxEntry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("titles an upsert with the display name", () => {
    const entry = baseEntry({
      contact: { id: 1, firstName: "Ali", lastName: "Khan" } as Contact,
    });
    expect(describeContactsOutboxEntry(entry)).toEqual({ title: "Ali Khan", subtitle: "upsert" });
  });

  it("falls back to the id when the upsert has no name", () => {
    expect(describeContactsOutboxEntry(baseEntry({}))).toEqual({ title: "1", subtitle: "upsert" });
  });

  it("titles an update with the display name and contactId fallback", () => {
    const entry = baseEntry({
      kind: "update",
      contactId: "c-7",
      contact: { id: 7, firstName: "Zain" } as Contact,
    });
    expect(describeContactsOutboxEntry(entry)).toEqual({ title: "Zain", subtitle: "update" });
    const unnamed = baseEntry({ kind: "update", contactId: "c-7", contact: { id: 7 } as Contact });
    expect(describeContactsOutboxEntry(unnamed)).toEqual({ title: "c-7", subtitle: "update" });
  });

  it("titles a delete with the contactId", () => {
    const entry = baseEntry({ kind: "delete", contactId: "c-9" });
    expect(describeContactsOutboxEntry(entry)).toEqual({ title: "c-9", subtitle: "delete" });
  });
});
