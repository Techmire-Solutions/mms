import { describe, expect, it } from "vitest";
import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";
import { sessionCreateBodySchema } from "../schemas/sessions.dto.js";
import {
  SessionInsertSchema,
  isSessionDeleted,
  filterActiveSessions,
} from "../sessions/sessionTypes.js";

describe("sessionWriteSchema", () => {
  it("CLIENT_SOFT_DELETE_KEYS contains all six soft-delete and restore fields", () => {
    expect(CLIENT_SOFT_DELETE_KEYS).toEqual([
      "deletedAt",
      "deletedBy",
      "deletionReason",
      "restoredAt",
      "restoredBy",
      "deletedWithCascade",
    ]);
  });

  it("stripClientSoftDeleteFields removes all soft-delete, restore, and cascade metadata", () => {
    const stripped = stripClientSoftDeleteFields({
      name: "Spring 2026",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u1",
      deletionReason: "Archived",
      restoredAt: "2026-02-01T00:00:00.000Z",
      restoredBy: "u2",
      deletedWithCascade: true,
    });
    expect(stripped.deletedAt).toBeUndefined();
    expect(stripped.deletedBy).toBeUndefined();
    expect(stripped.deletionReason).toBeUndefined();
    expect(stripped.restoredAt).toBeUndefined();
    expect(stripped.restoredBy).toBeUndefined();
    expect(stripped.deletedWithCascade).toBeUndefined();
    expect(stripped.name).toBe("Spring 2026");
  });

  it("sessionCreateBodySchema strips client-supplied soft-delete fields", () => {
    const parsed = sessionCreateBodySchema.safeParse({
      name: "Fall 2026",
      type: "term",
      status: "active",
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      baseFee: 1000,
      currency: "PKR",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u1",
      deletionReason: "test",
      restoredAt: "2026-01-02T00:00:00.000Z",
      restoredBy: "u2",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("deletedAt");
      expect(data).not.toHaveProperty("deletedBy");
      expect(data).not.toHaveProperty("deletionReason");
      expect(data).not.toHaveProperty("restoredAt");
      expect(data).not.toHaveProperty("restoredBy");
      expect(data.name).toBe("Fall 2026");
    }
  });

  it("SessionInsertSchema omits soft delete and restore fields", () => {
    const parsed = SessionInsertSchema.safeParse({
      name: "Winter 2026",
      type: "term",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      baseFee: 500,
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    // SessionInsertSchema is strict and rejects deletedAt
    expect(parsed.success).toBe(false);
  });

  it("isSessionDeleted identifies soft-deleted sessions", () => {
    expect(isSessionDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isSessionDeleted({ deletedAt: null })).toBe(false);
    expect(isSessionDeleted({})).toBe(false);
  });

  it("filterActiveSessions filters out archived sessions", () => {
    const records = [
      { id: "s1", name: "Active Session" },
      { id: "s2", name: "Archived Session", deletedAt: "2026-01-01T00:00:00.000Z" },
      { id: "s3", name: "Another Active", deletedAt: null },
    ];
    expect(filterActiveSessions(records).map((s) => s.id)).toEqual(["s1", "s3"]);
  });
});
