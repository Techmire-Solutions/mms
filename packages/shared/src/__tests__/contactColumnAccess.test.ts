import { describe, expect, it } from "vitest";
import {
  canViewContactColumn,
  resolveContactColumnField,
  type ContactColumnFieldContext,
} from "../contacts/contactColumnAccess.js";
import type { FieldDefinition } from "../contacts/contactFieldSchemaTypes.js";

function makeField(key: string, overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    key,
    label: key,
    type: "text",
    enabled: true,
    order: 0,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ContactColumnFieldContext> = {},
): ContactColumnFieldContext {
  const fields: Record<string, FieldDefinition[]> = {
    basic: [makeField("firstName"), makeField("gender")],
    phones: [makeField("number"), makeField("label")],
    relationship: [makeField("contactId"), makeField("relationship")],
  };
  const enabledTabIds = new Set<string>(["basic", "phones", "relationship"]);
  const isTabFieldEnabled = (tabId: string, fieldId: string): boolean => {
    if (tabId === "basic") return true;
    return enabledTabIds.has(tabId) && Boolean(fields[tabId]?.find((f) => f.key === fieldId));
  };
  return { fields, enabledTabIds, isTabFieldEnabled, ...overrides };
}

describe("contactColumnAccess", () => {
  describe("resolveContactColumnField", () => {
    it("resolves name to the firstName field when the basic tab has it enabled", () => {
      const field = resolveContactColumnField("name", makeContext());
      expect(field?.key).toBe("firstName");
    });

    it("returns null for name when firstName is disabled", () => {
      const context = makeContext({
        isTabFieldEnabled: (tabId, fieldId) => !(tabId === "basic" && fieldId === "firstName"),
      });
      expect(resolveContactColumnField("name", context)).toBeNull();
    });

    it("requires the phones tab enabled for the phone column", () => {
      const context = makeContext({ enabledTabIds: new Set(["basic"]) });
      expect(resolveContactColumnField("phone", context)).toBeNull();
    });

    it("resolves phone to the number field when phones is enabled", () => {
      const field = resolveContactColumnField("phone", makeContext());
      expect(field?.key).toBe("number");
    });

    it("resolves gender through the basic tab field check", () => {
      const field = resolveContactColumnField("gender", makeContext());
      expect(field?.key).toBe("gender");
    });

    it("resolves a relationship_contact column through the relationship tab", () => {
      const field = resolveContactColumnField("relationship_contact", makeContext());
      expect(field?.key).toBe("contactId");
    });

    it("returns null for relationship columns when no relationship fields exist", () => {
      const context = makeContext({
        fields: { basic: [makeField("firstName")], phones: [makeField("number")] },
        enabledTabIds: new Set(["basic"]),
      });
      expect(resolveContactColumnField("relationship_type", context)).toBeNull();
    });

    it("resolves an unknown custom tab field key via the tab-field walk", () => {
      const context = makeContext({
        fields: {
          basic: [makeField("firstName")],
          customTab: [makeField("customField")],
        },
        enabledTabIds: new Set(["basic", "customTab"]),
      });
      const field = resolveContactColumnField("customField", context);
      expect(field?.key).toBe("customField");
    });
  });

  describe("canViewContactColumn", () => {
    it("returns true when no governing field exists", () => {
      expect(canViewContactColumn("teacher", "unknownColumn", makeContext())).toBe(true);
    });

    it("returns false when the governing field is disabled", () => {
      const context = makeContext({
        fields: {
          basic: [makeField("firstName", { enabled: false })],
          phones: [makeField("number")],
        },
      });
      expect(canViewContactColumn("teacher", "name", context)).toBe(false);
    });

    it("returns role-gated result for the governing field", () => {
      const context = makeContext({
        fields: {
          basic: [makeField("firstName", { permissions: ["admin"] })],
          phones: [makeField("number")],
        },
      });
      expect(canViewContactColumn("admin", "name", context)).toBe(true);
      expect(canViewContactColumn("teacher", "name", context)).toBe(false);
    });
  });
});
