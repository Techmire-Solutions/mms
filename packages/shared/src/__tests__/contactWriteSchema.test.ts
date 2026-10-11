import { describe, expect, it } from "vitest";
import {
  buildContactWriteSchema,
  contactWriteSchema,
  collectContactWriteExtraFieldKeys,
} from "../schemas/contacts.dto.js";
import type { FieldConfig } from "../contactTypes.js";

describe("contactWriteSchema allowlist", () => {
  it("strips client soft-delete fields", () => {
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

  it("rejects unknown top-level keys on the system-only schema", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      evilPayload: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts Setup custom keys when included in the allowlist", () => {
    const schema = buildContactWriteSchema(["customNote"]);
    const parsed = schema.safeParse({
      firstName: "Ali",
      customNote: "hello",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as { customNote?: string }).customNote).toBe("hello");
    }
  });

  it("accepts notes, line1, address, and tag/tags scalar mirrors on the system schema", () => {
    const parsed = contactWriteSchema.safeParse({
      firstName: "Ali",
      notes: "Some notes",
      line1: "123 Main St",
      address: "123 Main St",
      city: "Karachi",
      tag: "VIP, Donor",
      tags: ["VIP", "Donor"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data.notes).toBe("Some notes");
      expect(data.line1).toBe("123 Main St");
      expect(data.address).toBe("123 Main St");
      expect(data.tag).toBe("VIP, Donor");
      expect(data.tags).toEqual(["VIP", "Donor"]);
    }
  });

  it("collectContactWriteExtraFieldKeys gathers enabled custom field keys", () => {
    const config = {
      version: 1,
      fields: {
        basic: [
          { key: "firstName", type: "text", label: "First", enabled: true, required: true },
          { key: "customNote", type: "text", label: "Note", enabled: true, required: false },
          { key: "disabledNote", type: "text", label: "Off", enabled: false, required: false },
        ],
      },
    } as unknown as FieldConfig;
    expect(collectContactWriteExtraFieldKeys(config)).toEqual(["customNote"]);
  });
});
