import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../lib/pgErrors.js";
import {
  mergeStudentPatch,
  prepareStudentRecord,
  resolveStudentRowId,
  throwGrUniqueConflict,
} from "../students/use-cases/studentNormalizeUseCases.js";

describe("studentNormalizeUseCases", () => {
  describe("resolveStudentRowId", () => {
    it("passes through a supplied id", () => {
      expect(resolveStudentRowId("s1")).toBe("s1");
      expect(resolveStudentRowId(42)).toBe("42");
    });

    it("generates a st-<uuid> prefixed id when absent", () => {
      const id = resolveStudentRowId(undefined);
      expect(id).toMatch(/^st-[0-9a-f-]{36}$/);
    });

    it("generates a fresh id each call", () => {
      expect(resolveStudentRowId(undefined)).not.toBe(resolveStudentRowId(undefined));
    });

    it("generates a st-<uuid> prefixed id when id is empty or blank string or null", () => {
      expect(resolveStudentRowId("")).toMatch(/^st-[0-9a-f-]{36}$/);
      expect(resolveStudentRowId("   ")).toMatch(/^st-[0-9a-f-]{36}$/);
      expect(resolveStudentRowId(null)).toMatch(/^st-[0-9a-f-]{36}$/);
    });
  });

  describe("isUniqueViolation", () => {
    it("returns false for null / non-objects", () => {
      expect(isUniqueViolation(null)).toBe(false);
      expect(isUniqueViolation(undefined)).toBe(false);
      expect(isUniqueViolation("nope")).toBe(false);
    });

    it("returns true for a top-level Postgres 23505 code", () => {
      expect(isUniqueViolation({ code: "23505" })).toBe(true);
    });

    it("returns true for a nested cause chain", () => {
      expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(true);
    });

    it("returns false for other codes", () => {
      expect(isUniqueViolation({ code: "23503" })).toBe(false);
      expect(isUniqueViolation({})).toBe(false);
    });
  });

  describe("throwGrUniqueConflict", () => {
    it("re-throws the original error when not a unique violation", () => {
      const original = new Error("boom");
      expect(() => throwGrUniqueConflict(original)).toThrow("boom");
    });

    it("throws a 409 conflict with type conflict on unique violation", () => {
      try {
        throwGrUniqueConflict({ code: "23505" });
        throw new Error("expected throw");
      } catch (error) {
        const conflict = error as Error & { statusCode: number; type: string };
        expect(conflict.statusCode).toBe(409);
        expect(conflict.type).toBe("conflict");
        expect(conflict.message).toMatch(/GR number already exists/);
      }
    });
  });

  describe("prepareStudentRecord", () => {
    it("parses a minimal record and assigns a generated id", () => {
      const parsed = prepareStudentRecord({ name: "Aisha Khan" });
      expect(parsed.name).toBe("Aisha Khan");
      expect(parsed.id).toMatch(/^st-[0-9a-f-]{36}$/);
    });

    it("keeps an explicit id", () => {
      const parsed = prepareStudentRecord({ id: "s-9", name: "Aisha" });
      expect(parsed.id).toBe("s-9");
    });

    it("strips client soft-delete metadata", () => {
      const parsed = prepareStudentRecord({
        name: "Aisha",
        deleted: true,
        deletedAt: "2026-01-01T00:00:00.000Z",
        deletedBy: "u1",
        deletionReason: "duplicate",
      } as never);
      expect(parsed).not.toHaveProperty("deleted");
      expect(parsed).not.toHaveProperty("deletedAt");
      expect(parsed).not.toHaveProperty("deletedBy");
    });

    it("strips contact-owned guardian link fields (SSOT on contacts)", () => {
      const parsed = prepareStudentRecord({
        name: "Aisha",
        contactId: "c-1",
        fatherContactId: "c-2",
        guardianName: "Imran",
      } as never);
      expect(parsed).not.toHaveProperty("fatherContactId");
      expect(parsed).not.toHaveProperty("guardianName");
    });

    it("preserves GR and Student-ID casing from literal-case templates", () => {
      const parsed = prepareStudentRecord({
        name: "Aisha",
        grNumber: "  GR26001 ",
        studentId: " ST-9X ",
      } as never);
      expect(parsed.grNumber).toBe("GR26001");
      expect(parsed.studentId).toBe("ST-9X");
    });

    it("strips server-owned audit attribution and timestamps from the payload", () => {
      // F-1: createdAt reached the insert through mapAuditToInsert, so a REST client could
      // forge the row's creation time (and corrupt audit/metrics that bucket on it).
      const parsed = prepareStudentRecord({
        name: "Aisha",
        createdAt: "1999-01-01T00:00:00.000Z",
        updatedAt: "1999-01-01T00:00:00.000Z",
        createdBy: "u-forged",
        updatedBy: "u-forged",
      } as never);
      expect(parsed).not.toHaveProperty("createdAt");
      expect(parsed).not.toHaveProperty("updatedAt");
      expect(parsed).not.toHaveProperty("createdBy");
      expect(parsed).not.toHaveProperty("updatedBy");
    });

    it("drops the nested customFields map but keeps the flattened custom keys", () => {
      // m5: the read mapper emits both shapes; accepting the map must not become a second write
      // surface that bypasses the strict allowlist.
      const parsed = prepareStudentRecord({
        name: "Aisha",
        nickname: "Aisha K",
        customFields: { nickname: "Aisha K", restricted: "leak" },
      } as never);
      expect(parsed).not.toHaveProperty("customFields");
      expect(parsed.nickname).toBe("Aisha K");
    });
  });

  describe("mergeStudentPatch", () => {
    it("merges patch keys onto the existing row", () => {
      const merged = mergeStudentPatch(
        { id: "s1", name: "Aisha", status: "active" },
        { status: "graduated", grNumber: "GR-9" },
      );
      expect(merged).toEqual({ id: "s1", name: "Aisha", status: "graduated", grNumber: "GR-9" });
    });

    it("ignores undefined patch keys so omitted optional fields survive", () => {
      const merged = mergeStudentPatch(
        { id: "s1", name: "Aisha", city: "Karachi" },
        { name: "Aisha B", city: undefined, notes: undefined },
      );
      expect(merged).toEqual({ id: "s1", name: "Aisha B", city: "Karachi" });
    });

    it("overwrites with explicit null values", () => {
      const merged = mergeStudentPatch(
        { id: "s1", guardianName: "Imran", city: "Karachi" },
        { guardianName: null, city: "Lahore" },
      );
      expect(merged).toEqual({ id: "s1", guardianName: null, city: "Lahore" });
    });
  });
});
