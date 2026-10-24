import { describe, expect, it } from "vitest";
import {
  CONTACT_RETIRED_CLASSIFICATION_KEYS,
  CONTACT_RETIRED_OBJECT_KEYS,
  isContactRetiredClassificationKey,
  sanitizeContactSeedObjects,
  stripContactRetiredClassificationFields,
} from "../contacts/contactTypes.js";

describe("contact classification SSOT", () => {
  it("recognizes retired classification keys", () => {
    for (const key of CONTACT_RETIRED_CLASSIFICATION_KEYS) {
      expect(isContactRetiredClassificationKey(key)).toBe(true);
    }
    expect(isContactRetiredClassificationKey("firstName")).toBe(false);
  });

  it("strips retired fields from contact-shaped records", () => {
    const cleaned = stripContactRetiredClassificationFields({
      firstName: "Fatima",
      lifecycleStage: "Staff",
      persona: "staff",
      city: "Karachi",
    });
    expect(cleaned).toEqual({ firstName: "Fatima", city: "Karachi" });
  });

  it("removes retired objects and classification columns from seed objects", () => {
    const sanitized = sanitizeContactSeedObjects({
      lifecycleColors: { Staff: { bg: "x" } },
      lifecycleStages: ["Lead", "Staff"],
      contact_field_config: {
        columnRegistry: [
          { key: "name", enabled: true },
          { key: "lifecycleStage", enabled: true },
          { key: "persona", enabled: true },
        ],
        fields: {
          basic: [
            { key: "firstName", type: "text" },
            { key: "lifecycleStage", type: "select" },
          ],
        },
      },
      other: { keep: true },
    });

    for (const key of CONTACT_RETIRED_OBJECT_KEYS) {
      expect(sanitized[key]).toBeUndefined();
    }
    expect(sanitized.other).toEqual({ keep: true });

    const config = sanitized.contact_field_config as {
      columnRegistry: Array<{ key: string }>;
      fields: { basic: Array<{ key: string }> };
    };
    expect(config.columnRegistry.map((column) => column.key)).toEqual(["name"]);
    expect(config.fields.basic.map((field) => field.key)).toEqual(["firstName"]);
  });
});
