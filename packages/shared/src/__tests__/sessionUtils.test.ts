import { describe, expect, it } from "vitest";
import {
  normalizeStoredSession,
  stripSessionClientSoftDeleteFields,
} from "../sessions/sessionUtils.js";

describe("sessionUtils", () => {
  it("stripSessionClientSoftDeleteFields removes soft-delete metadata", () => {
    const stripped = stripSessionClientSoftDeleteFields({
      id: "sess-1",
      name: "Morning",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-admin",
      deletionReason: "Ended",
    });
    expect(stripped).toEqual({ id: "sess-1", name: "Morning" });
  });

  it("normalizeStoredSession strips soft-delete keys", () => {
    const normalized = normalizeStoredSession({
      id: "sess-1",
      deletedBy: "u-admin",
      deletionReason: "Ended",
    });
    expect(normalized).toEqual({ id: "sess-1" });
  });
});
