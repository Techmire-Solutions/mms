import { describe, expect, it } from "vitest";
import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";
import { sessionCreateBodySchema, sessionUpdateBodySchema } from "../schemas/sessions.dto.js";
import {
  SessionInsertSchema,
  SessionSchema,
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

  it("round-trips a full read-shaped session and strips nested read-only fields", () => {
    // Shape matches `sessionRowToRecord` output (the production read mapper).
    const readSession = SessionSchema.parse({
      id: "sess-1",
      name: "Spring 2026",
      status: "open",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: 1000,
      currency: "PKR",
      version: 3,
      overlapExempt: true,
      classes: [
        {
          id: "c1",
          name: "Class A",
          enrolled: 25,
          sections: [
            {
              id: "sec-1",
              name: "A",
              capacity: 30,
              status: "active",
              classTeacherId: "t-1",
              classTeacherName: "Ustadh Ali",
              enrolled: 12,
            },
          ],
        },
      ],
      faculty: [
        {
          id: "fac-1",
          sessionId: "sess-1",
          facultyId: "t-1",
          facultyName: "Ustadh Ali",
          role: "Lead Instructor",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const created = sessionCreateBodySchema.safeParse(readSession);
    expect(created.success).toBe(true);
    if (created.success) {
      const data = created.data as {
        classes?: Array<{
          enrolled?: unknown;
          sections?: Array<{
            classTeacherId?: unknown;
            classTeacherName?: unknown;
            enrolled?: unknown;
          }>;
        }>;
        faculty?: Array<{ createdAt?: unknown }>;
      };
      // The client-supplied `enrolled: 25` is stripped; the class schema's default re-derives `0`.
      expect(data.classes?.[0]?.enrolled).toBe(0);
      expect(data.classes?.[0]?.sections?.[0]?.classTeacherId).toBeUndefined();
      expect(data.classes?.[0]?.sections?.[0]?.classTeacherName).toBeUndefined();
      expect(data.classes?.[0]?.sections?.[0]?.enrolled).toBeUndefined();
      expect(data.faculty?.[0]?.createdAt).toBeUndefined();
    }

    const updated = sessionUpdateBodySchema.safeParse(readSession);
    expect(updated.success).toBe(true);
  });
});
