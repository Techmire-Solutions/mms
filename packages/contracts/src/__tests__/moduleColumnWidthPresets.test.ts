import { describe, expect, it } from "vitest";
import {
  applyModuleColumnOverlay,
  createColumnRegistry,
  getModuleColumnWidth,
  MODULE_COLUMN_KIND_WIDTHS,
  MODULE_COLUMN_KINDS,
  MODULE_COLUMN_WIDTH_MAX,
  MODULE_COLUMN_WIDTH_MIN,
  resolveModuleColumnWidth,
  type ModuleColumnRegistryEntry,
} from "../settings/moduleColumnPreferences.js";

describe("module column width presets", () => {
  it("defines a default and minimum inside the global bounds for every kind", () => {
    for (const kind of MODULE_COLUMN_KINDS) {
      const preset = MODULE_COLUMN_KIND_WIDTHS[kind];
      expect(preset.minWidth).toBeGreaterThanOrEqual(MODULE_COLUMN_WIDTH_MIN);
      expect(preset.width).toBeGreaterThanOrEqual(preset.minWidth);
      expect(preset.width).toBeLessThanOrEqual(MODULE_COLUMN_WIDTH_MAX);
    }
  });

  it("uses the kind default when no width is stored", () => {
    expect(resolveModuleColumnWidth(undefined, "phone")).toBe(
      MODULE_COLUMN_KIND_WIDTHS.phone.width,
    );
  });

  it("raises a stored width below the kind minimum", () => {
    expect(resolveModuleColumnWidth(80, "chips")).toBe(MODULE_COLUMN_KIND_WIDTHS.chips.minWidth);
  });

  it("keeps a stored width at or above the kind minimum", () => {
    const wide = MODULE_COLUMN_KIND_WIDTHS.email.minWidth + 40;
    expect(resolveModuleColumnWidth(wide, "email")).toBe(wide);
  });

  it("only clamps to global bounds when the column has no kind", () => {
    expect(resolveModuleColumnWidth(10, undefined)).toBe(MODULE_COLUMN_WIDTH_MIN);
    expect(resolveModuleColumnWidth(undefined, undefined)).toBeUndefined();
  });

  it("treats a zero width as auto (unsized) rather than the global minimum", () => {
    expect(resolveModuleColumnWidth(0, undefined)).toBeUndefined();
    expect(resolveModuleColumnWidth(0, "date")).toBe(MODULE_COLUMN_KIND_WIDTHS.date.width);
  });

  it("ignores non-finite stored widths", () => {
    expect(resolveModuleColumnWidth(Number.NaN, "date")).toBe(MODULE_COLUMN_KIND_WIDTHS.date.width);
  });

  it("seeds registry widths from kinds", () => {
    const registry = createColumnRegistry(
      ["name", "amount", "notes"],
      { name: "Name", amount: "Amount", notes: "Notes" },
      true,
      { name: "identity", amount: "money" },
    );
    expect(registry[0]).toMatchObject({ kind: "identity", width: 240, fixed: true });
    expect(registry[1]).toMatchObject({ kind: "money", width: 130 });
    expect(registry[2].kind).toBeUndefined();
    expect(registry[2].width).toBeUndefined();
  });

  it("floors stale stored overlay widths at the kind minimum", () => {
    const registry: ModuleColumnRegistryEntry[] = [
      { key: "tags", label: "Tags", enabled: true, order: 0, kind: "chips", width: 220 },
    ];
    const overlay = applyModuleColumnOverlay(registry, [
      { key: "tags", enabled: true, order: 0, width: 80 },
    ]);
    expect(getModuleColumnWidth(overlay, "tags")).toBe(MODULE_COLUMN_KIND_WIDTHS.chips.minWidth);
  });
});
