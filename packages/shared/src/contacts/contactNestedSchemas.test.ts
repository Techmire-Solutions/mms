import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import {
  phoneNumberSchema,
  emailAddressSchema,
  addressSchema,
  socialLinkSchema,
  relationshipContactSchema,
  relationshipSchema,
  activitySchema,
  attachmentSchema,
} from "./contactNestedSchemas.js";

describe("contactNestedSchemas", () => {
  const validSamples: Array<{ schema: ZodTypeAny; valid: Record<string, unknown> }> = [
    { schema: phoneNumberSchema, valid: { number: "+923001234567" } },
    { schema: emailAddressSchema, valid: { address: "a@example.com" } },
    { schema: addressSchema, valid: { line1: "1 Main St", city: "Lahore" } },
    { schema: socialLinkSchema, valid: { platform: "Instagram", url: "https://instagram.com/a" } },
    { schema: relationshipContactSchema, valid: { contactId: "c1", relationship: "Parent" } },
    { schema: relationshipSchema, valid: { contactId: "c1" } },
    {
      schema: activitySchema,
      valid: { id: "act-1", type: "note", content: "Follow up", date: "2026-07-27T00:00:00.000Z" },
    },
    {
      schema: attachmentSchema,
      valid: {
        id: "att-1",
        name: "doc.pdf",
        type: "application/pdf",
        size: 1024,
        url: "https://x/doc.pdf",
        date: "2026-07-27",
      },
    },
  ];

  for (const { schema, valid } of validSamples) {
    it(`parses a valid ${schema.description ?? "nested schema"} object`, () => {
      expect(schema.safeParse(valid).success).toBe(true);
    });

    it(`rejects an unknown key on ${schema.description ?? "nested schema"} (strict)`, () => {
      const result = schema.safeParse({ ...valid, extraKey: "nope" });
      expect(result.success).toBe(false);
    });
  }

  it("requires a phone number", () => {
    expect(phoneNumberSchema.safeParse({ label: "Mobile" }).success).toBe(false);
  });

  it("requires a relationship contactId", () => {
    expect(relationshipSchema.safeParse({ relationship: "Parent" }).success).toBe(false);
  });

  it("requires the activity identity fields and restricts type", () => {
    expect(
      activitySchema.safeParse({ type: "note", content: "x", date: "2026-07-27" }).success,
    ).toBe(false);
    expect(
      activitySchema.safeParse({
        id: "a",
        type: "unknown-kind",
        content: "x",
        date: "2026-07-27",
      }).success,
    ).toBe(false);
  });

  it("requires all attachment fields", () => {
    expect(
      attachmentSchema.safeParse({ id: "a", name: "doc.pdf", type: "pdf", size: 1 }).success,
    ).toBe(false);
  });
});
