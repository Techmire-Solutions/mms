import { describe, it, expect } from "vitest";
import { ENTITY_REGISTRY } from "@/components/common/entityRegistry";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

const ALLOWED_BADGE_CLASSES = new Set<string>(Object.values(SEMANTIC_BADGE));

describe("entity registry invariants", () => {
  it("contains all 16 domain entity registrations", () => {
    const expectedEntities = [
      "contacts",
      "students",
      "faculty",
      "sessions",
      "finance",
      "attendance",
      "enrollments",
      "hasanat",
      "obligations",
      "platformWorkspaces",
      "platformUsers",
      "platformSettings",
      "questionBank",
      "users",
      "examinations",
      "messaging",
    ];
    expect(Object.keys(ENTITY_REGISTRY).sort()).toEqual(expectedEntities.sort());
  });

  it("registers every entity under its own entityType", () => {
    for (const [registryKey, descriptor] of Object.entries(ENTITY_REGISTRY)) {
      expect(descriptor.entityType).toBe(registryKey);
    }
  });

  it("descriptors have unique field keys and unique table column orders", () => {
    for (const descriptor of Object.values(ENTITY_REGISTRY)) {
      const keys = descriptor.fields.map((field) => field.key);
      expect(new Set(keys).size, `${descriptor.entityType} duplicate field keys`).toBe(keys.length);
      const orders = descriptor.getTableColumns().map((column) => column.order);
      expect(new Set(orders).size, `${descriptor.entityType} duplicate table orders`).toBe(
        orders.length,
      );
    }
  });

  it("every descriptor has at least 1 fixed table column", () => {
    for (const descriptor of Object.values(ENTITY_REGISTRY)) {
      const fixedColumns = descriptor.getTableColumns().filter((col) => col.fixed);
      expect(
        fixedColumns.length,
        `${descriptor.entityType} must define at least 1 fixed column for table freeze pin`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("every field has a non-empty key, label, and type", () => {
    for (const descriptor of Object.values(ENTITY_REGISTRY)) {
      for (const field of descriptor.fields) {
        expect(
          field.key.trim().length,
          `${descriptor.entityType} field key is empty`,
        ).toBeGreaterThan(0);
        expect(
          field.label.trim().length,
          `${descriptor.entityType}.${field.key} label is empty`,
        ).toBeGreaterThan(0);
        expect(
          field.type.trim().length,
          `${descriptor.entityType}.${field.key} type is empty`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("badge classNames resolve only to semanticTone SSOT values", () => {
    for (const descriptor of Object.values(ENTITY_REGISTRY)) {
      for (const field of descriptor.fields) {
        for (const [variant, config] of Object.entries(field.badgeVariantMap ?? {})) {
          if (config.className) {
            expect(
              ALLOWED_BADGE_CLASSES.has(config.className),
              `${descriptor.entityType}.${field.key}.${variant} uses a non-SSOT badge class`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("all drawer sections have non-empty ids, titles, and fields", () => {
    for (const descriptor of Object.values(ENTITY_REGISTRY)) {
      for (const section of descriptor.getDrawerSections()) {
        expect(
          section.id.trim().length,
          `${descriptor.entityType} section id is empty`,
        ).toBeGreaterThan(0);
        expect(
          section.title.trim().length,
          `${descriptor.entityType} section title is empty`,
        ).toBeGreaterThan(0);
        expect(
          section.fields.length,
          `${descriptor.entityType} section ${section.id} is empty`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
