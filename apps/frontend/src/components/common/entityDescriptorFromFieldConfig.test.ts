import { describe, it, expect, vi } from "vitest";
import type { FieldDefinition as RegistryFieldDefinition } from "@mms/shared";
import {
  createEntityDescriptorFromFieldConfig,
  mapRegistryFieldType,
} from "@/components/common/entityDescriptorFromFieldConfig";

const f = (over: Partial<RegistryFieldDefinition>): RegistryFieldDefinition => ({
  key: "k",
  label: "L",
  type: "text",
  enabled: true,
  order: 1,
  ...over,
});

describe("createEntityDescriptorFromFieldConfig", () => {
  it("maps registry field types to descriptor value types", () => {
    expect(mapRegistryFieldType("text")).toBe("text");
    expect(mapRegistryFieldType("currency")).toBe("currency");
    expect(mapRegistryFieldType("select")).toBe("badge");
    expect(mapRegistryFieldType("single_select")).toBe("badge");
    expect(mapRegistryFieldType("boolean")).toBe("boolean");
    expect(mapRegistryFieldType("email")).toBe("email");
    expect(mapRegistryFieldType("url")).toBe("link");
    expect(mapRegistryFieldType("number")).toBe("number");
    expect(mapRegistryFieldType("date")).toBe("date");
    expect(mapRegistryFieldType("datetime")).toBe("datetime");
    expect(mapRegistryFieldType("unknown" as RegistryFieldDefinition["type"])).toBe("text");
  });

  it("builds a descriptor covering every enabled, viewable field, tab-ordered", () => {
    const resolveLabel = vi.fn((field: RegistryFieldDefinition) => `lbl:${field.key}`);
    const fieldsByTab: Record<string, RegistryFieldDefinition[]> = {
      identity: [
        f({ key: "name", type: "text", order: 10 }),
        f({ key: "gender", type: "select", order: 20, options: ["male", "female"] }),
        f({ key: "disabledField", enabled: false, order: 30 }),
      ],
      contact: [f({ key: "email", type: "email", order: 10 }), f({ key: "secret", order: 20 })],
    };
    const descriptor = createEntityDescriptorFromFieldConfig<Record<string, unknown>>({
      entityType: "testEntity",
      singularLabel: "Item",
      pluralLabel: "Items",
      idField: "id",
      titleField: "name",
      fieldsByTab,
      resolveLabel,
      canViewField: (field) => field.key !== "secret",
      fieldOverrides: {
        gender: {
          badgeVariantMap: {
            male: { label: "Male", tone: "info" },
          },
        },
      },
    });

    const keys = descriptor.fields.map((field) => field.key);
    expect(keys).toEqual(["name", "email", "gender"]); // sorted by drawerOrder: 10, 10, 20; disabled + non-viewable excluded
    expect(resolveLabel).toHaveBeenCalledTimes(3);
    expect(descriptor.getField("email")?.type).toBe("email");
    expect(descriptor.getField("gender")?.type).toBe("badge");
    expect(descriptor.getField("gender")?.badgeVariantMap?.male?.label).toBe("Male");
    expect(descriptor.getField("secret")).toBeUndefined();

    const sections = descriptor.getDrawerSections();
    expect(sections.map((s) => s.id)).toEqual(["identity", "contact"]);
    expect(sections[0]?.fields.map((field) => field.key)).toEqual(["name", "gender"]);
  });

  it("applies fieldOverrides over mapped defaults", () => {
    const descriptor = createEntityDescriptorFromFieldConfig<Record<string, unknown>>({
      entityType: "t",
      singularLabel: "T",
      pluralLabel: "Ts",
      idField: "id",
      titleField: "name",
      fieldsByTab: { general: [f({ key: "dob", type: "date" })] },
      resolveLabel: (field) => field.label,
      fieldOverrides: { dob: { type: "text", cardSlot: "hidden" } },
    });
    expect(descriptor.getField("dob")?.type).toBe("text");
    expect(descriptor.getCardFields().map((field) => field.key)).toEqual([]);
  });
});
