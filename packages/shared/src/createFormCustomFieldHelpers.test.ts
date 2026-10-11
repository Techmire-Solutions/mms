import { describe, expect, it } from "vitest";
import { createFormCustomFieldHelpers } from "./createFormCustomFieldHelpers.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";

function field(key: string, overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return { key, label: key, type: "text", enabled: true, order: 0, ...overrides };
}

const SEED: Record<string, FieldDefinition[]> = {
  basics: [field("firstName", { order: 1 }), field("phone", { order: 2 })],
  socials: [field("instagram", { order: 3 })],
};

describe("createFormCustomFieldHelpers", () => {
  const helpers = createFormCustomFieldHelpers(SEED);

  describe("listSystemFormFieldKeys", () => {
    it("returns the union of seed keys across tabs", () => {
      expect(helpers.listSystemFormFieldKeys()).toEqual(
        new Set(["firstName", "phone", "instagram"]),
      );
    });
  });

  describe("isSystemFormField", () => {
    it("is true for seed keys and false for custom keys", () => {
      expect(helpers.isSystemFormField("basics", "firstName")).toBe(true);
      expect(helpers.isSystemFormField("socials", "instagram")).toBe(true);
      expect(helpers.isSystemFormField("basics", "nickname")).toBe(false);
      expect(helpers.isSystemFormField("missingTab", "firstName")).toBe(false);
    });
  });

  describe("listEnabledCustomFormFields", () => {
    const fields: Record<string, FieldDefinition[]> = {
      basics: [
        field("firstName", { order: 1 }),
        field("nickname", { order: 4 }),
        field("disabledCustom", { enabled: false, order: 2 }),
      ],
      socials: [field("instagram", { order: 3 }), field("linkedin", { order: 1 })],
    };

    it("returns only enabled non-system fields, deduped and sorted by order then key", () => {
      const custom = helpers.listEnabledCustomFormFields(fields);
      expect(custom.map((entry) => entry.key)).toEqual(["linkedin", "nickname"]);
    });

    it("filters to a single tab when tabId is given", () => {
      const socials = helpers.listEnabledCustomFormFields(fields, "socials");
      expect(socials.map((entry) => entry.key)).toEqual(["linkedin"]);
    });

    it("excludes system and disabled custom fields", () => {
      const basics = helpers.listEnabledCustomFormFields(fields, "basics");
      expect(basics.map((entry) => entry.key)).toEqual(["nickname"]);
    });
  });
});
