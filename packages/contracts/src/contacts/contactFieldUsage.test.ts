import { describe, expect, it } from "vitest";
import {
  CONTACT_FIELD_USAGE_BATCH_MAX,
  contactFieldUsageBatchBodySchema,
  contactFieldUsageParamsSchema,
} from "./contactFieldUsage.js";

describe("contactFieldUsage schemas", () => {
  it("parses a valid batch body", () => {
    expect(contactFieldUsageBatchBodySchema.parse({ fieldKeys: ["customNotes", "city"] })).toEqual({
      fieldKeys: ["customNotes", "city"],
    });
  });

  it("rejects empty and oversized batches", () => {
    expect(() => contactFieldUsageBatchBodySchema.parse({ fieldKeys: [] })).toThrow();
    expect(() =>
      contactFieldUsageBatchBodySchema.parse({
        fieldKeys: Array.from({ length: CONTACT_FIELD_USAGE_BATCH_MAX + 1 }, (_, i) => `f${i}`),
      }),
    ).toThrow();
  });

  it("parses single-key path params", () => {
    expect(contactFieldUsageParamsSchema.parse({ fieldKey: "customNotes" })).toEqual({
      fieldKey: "customNotes",
    });
  });
});
