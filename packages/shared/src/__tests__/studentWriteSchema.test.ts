import { describe, expect, it } from "vitest";
import { buildStudentWriteSchema, studentWriteSchema } from "../schemas/students.dto.js";
import { collectStudentWriteExtraFieldKeys } from "../students/studentValidation.js";
import type { StudentsSettings } from "../students/studentsModuleSettings.js";

describe("studentWriteSchema allowlist", () => {
  it("strips client soft-delete fields", () => {
    const parsed = studentWriteSchema.safeParse({
      contactId: "c-1",
      grNumber: "GR-1",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u1",
      deletionReason: "x",
      deleted: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("deletedAt");
      expect(data).not.toHaveProperty("deletedBy");
      expect(data).not.toHaveProperty("deletionReason");
      expect(data).not.toHaveProperty("deleted");
      expect(data.contactId).toBe("c-1");
      expect(data.grNumber).toBe("GR-1");
    }
  });

  it("rejects unknown top-level keys on the system-only schema", () => {
    const parsed = studentWriteSchema.safeParse({
      contactId: "c-1",
      evilPayload: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts system keys sent by the student form", () => {
    const parsed = studentWriteSchema.safeParse({
      contactId: "c-1",
      grNumber: "GR-1",
      status: "active",
      registeredDate: "2026-01-01",
      enrolledSessions: ["s1", "s2"],
      notes: "notes",
      cnic: "12345",
      _blueprintId: "bp-1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data.registeredDate).toBe("2026-01-01");
      expect(data.enrolledSessions).toEqual(["s1", "s2"]);
    }
  });

  it("accepts Setup custom keys when included in the allowlist", () => {
    const schema = buildStudentWriteSchema(["customNote"]);
    const parsed = schema.safeParse({
      contactId: "c-1",
      customNote: "hello",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as { customNote?: string }).customNote).toBe("hello");
    }
  });

  it("rejects unknown keys even with custom extras present", () => {
    const schema = buildStudentWriteSchema(["customNote"]);
    const parsed = schema.safeParse({
      contactId: "c-1",
      customNote: "hello",
      evilPayload: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("collectStudentWriteExtraFieldKeys gathers enabled custom field keys", () => {
    const settings = {
      fields: {
        basic: [
          { key: "contactId", type: "text", label: "Contact", enabled: true },
          { key: "customNote", type: "text", label: "Note", enabled: true },
          { key: "disabledNote", type: "text", label: "Off", enabled: false },
        ],
      },
    } as unknown as StudentsSettings;
    expect(collectStudentWriteExtraFieldKeys(settings)).toEqual(["customNote"]);
  });
});
