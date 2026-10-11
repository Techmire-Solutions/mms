import { describe, expect, it } from "vitest";
import {
  filterActiveContacts,
  isContactDeleted,
  stripContactClientSoftDeleteFields,
} from "../contactSoftDelete.js";
import type { Contact } from "../contactTypes.js";
import { contactWriteSchema } from "../contactsModuleManifest.js";

const active: Contact = {
  id: "1",
  firstName: "Ali",
  name: "Ali",
};

const deleted: Contact = {
  id: "2",
  firstName: "Sara",
  name: "Sara",
  deletedAt: "2026-01-01T00:00:00.000Z",
};

describe("contactSoftDelete", () => {
  it("isContactDeleted detects deletedAt", () => {
    expect(isContactDeleted(active)).toBe(false);
    expect(isContactDeleted(deleted)).toBe(true);
  });

  it("stripContactClientSoftDeleteFields removes soft-delete metadata", () => {
    const stripped = stripContactClientSoftDeleteFields({
      ...deleted,
      firstName: "Ali",
    } as Record<string, unknown>);
    expect(stripped.deletedAt).toBeUndefined();
    expect(stripped.deletedBy).toBeUndefined();
    expect(stripped.deletionReason).toBeUndefined();
    expect(stripped.firstName).toBe("Ali");
  });

  it("contactWriteSchema strips client soft-delete fields", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u1",
      deletionReason: "x",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("deletedAt");
      expect(data).not.toHaveProperty("deletedBy");
      expect(data).not.toHaveProperty("deletionReason");
      expect(data.firstName).toBe("Ali");
    }
  });

  it("contactWriteSchema rejects unknown top-level keys", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      notAContactField: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("filterActiveContacts excludes soft-deleted rows", () => {
    expect(filterActiveContacts([active, deleted])).toEqual([active]);
  });

  it("safely handles null and undefined inputs", () => {
    expect(isContactDeleted(null)).toBe(false);
    expect(isContactDeleted(undefined)).toBe(false);
    expect(filterActiveContacts(null)).toEqual([]);
    expect(filterActiveContacts(undefined)).toEqual([]);
    expect(filterActiveContacts([active, null as unknown as Contact, deleted])).toEqual([active]);
  });
});
