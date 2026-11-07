import { describe, expect, it } from "vitest";
import {
  sessionErrorResponseSchema,
  sessionIdParamsSchema,
  sessionReadErrors,
  sessionResponseSchema,
  sessionWriteErrors,
} from "./sessionContractShared.js";

describe("sessionContractShared", () => {
  describe("sessionErrorResponseSchema", () => {
    it("validates standard error shape with optional violations", () => {
      const parsed = sessionErrorResponseSchema.parse({
        type: "conflict",
        message: "Session overlaps",
        violations: ["overlap_detected"],
      });
      expect(parsed.type).toBe("conflict");
      expect(parsed.violations).toEqual(["overlap_detected"]);
    });

    it("allows passthrough unknown fields", () => {
      const parsed = sessionErrorResponseSchema.parse({
        type: "error",
        message: "Something failed",
        extraField: 123,
      });
      expect((parsed as Record<string, unknown>).extraField).toBe(123);
    });
  });

  describe("sessionIdParamsSchema", () => {
    it("validates valid bounded session ids", () => {
      expect(sessionIdParamsSchema.parse({ id: "session-123" })).toEqual({ id: "session-123" });
    });

    it("trims whitespace from session id", () => {
      expect(sessionIdParamsSchema.parse({ id: "  s1  " })).toEqual({ id: "s1" });
    });

    it("rejects empty or excessively long ids", () => {
      expect(() => sessionIdParamsSchema.parse({ id: "" })).toThrow();
      expect(() => sessionIdParamsSchema.parse({ id: "a".repeat(65) })).toThrow();
    });
  });

  describe("sessionResponseSchema", () => {
    it("omits internal server fields like overlapExempt, deletedBy, restoredBy", () => {
      const parsed = sessionResponseSchema.parse({
        id: "s1",
        name: "Academic Year 2026",
        startDate: "2026-03-01",
        endDate: "2026-12-31",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        status: "open",
        overlapExempt: true,
        deletedBy: "user-1",
        restoredBy: "user-2",
      });
      expect(parsed).not.toHaveProperty("overlapExempt");
      expect(parsed).not.toHaveProperty("deletedBy");
      expect(parsed).not.toHaveProperty("restoredBy");
    });

    it("rejects a status outside the lifecycle and accepts legacy aliases on read", () => {
      expect(() =>
        sessionResponseSchema.parse({ id: "s1", name: "Bad", status: "planning" }),
      ).toThrow();
      expect(
        sessionResponseSchema.parse({ id: "s2", name: "Legacy", status: "active" }).status,
      ).toBe("in_progress");
    });
  });

  describe("error status maps", () => {
    it("sessionReadErrors contains 400, 401, 403, 404, 500", () => {
      expect(Object.keys(sessionReadErrors).map(Number).sort()).toEqual([400, 401, 403, 404, 500]);
    });

    it("sessionWriteErrors contains 400, 401, 403, 404, 409, 428, 500", () => {
      expect(Object.keys(sessionWriteErrors).map(Number).sort()).toEqual([
        400, 401, 403, 404, 409, 428, 500,
      ]);
    });
  });
});
