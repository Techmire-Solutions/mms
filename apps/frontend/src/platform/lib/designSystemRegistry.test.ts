import { describe, expect, it } from "vitest";
import { DESIGN_SYSTEM_PRIMITIVES, DESIGN_SYSTEM_SECTIONS } from "./designSystemRegistry";

/** Sanctioned primitives from mms-ui-ux-design §1 that the gallery must catalog once. */
const REQUIRED_PRIMITIVES = [
  "Button",
  "Input",
  "LeadingIconInput",
  "FormSelect",
  "EditableSelect",
  "Textarea",
  "Checkbox",
  "Switch",
  "EmptyState",
  "ErrorState",
  "StatusBadge",
  "StatCard",
  "Breadcrumb",
] as const;

describe("designSystemRegistry", () => {
  it("given gallery registry, should list each required primitive exactly once", () => {
    const counts = new Map<string, number>();
    for (const name of DESIGN_SYSTEM_PRIMITIVES) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    for (const name of REQUIRED_PRIMITIVES) {
      expect(counts.get(name), `${name} missing from gallery`).toBe(1);
    }

    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it("given gallery sections, should cover actions through layout", () => {
    expect(DESIGN_SYSTEM_SECTIONS.map((s) => s.id)).toEqual([
      "actions",
      "inputs",
      "feedback",
      "overlays",
      "data",
      "layout",
    ]);
  });
});
