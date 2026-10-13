import { describe, expect, it } from "vitest";
import {
  applyModuleColumnOverlay,
  clampModuleColumnWidth,
  getModuleColumnWidth,
  mergeModuleColumnPreferences,
  MODULE_COLUMN_WIDTH_MAX,
  MODULE_COLUMN_WIDTH_MIN,
  type ModuleColumnRegistryEntry,
} from "../settings/moduleColumnPreferences.js";

describe("module column widths", () => {
  it("clamps widths into the supported range", () => {
    expect(clampModuleColumnWidth(10)).toBe(MODULE_COLUMN_WIDTH_MIN);
    expect(clampModuleColumnWidth(900)).toBe(MODULE_COLUMN_WIDTH_MAX);
    expect(clampModuleColumnWidth(160.6)).toBe(161);
  });

  it("overlays stored widths onto the registry", () => {
    const registry: ModuleColumnRegistryEntry[] = [
      { key: "name", label: "Name", enabled: true, order: 0, fixed: true },
      { key: "status", label: "Status", enabled: true, order: 1 },
    ];
    const overlay = applyModuleColumnOverlay(registry, [
      { key: "name", enabled: true, order: 0, width: 220 },
      { key: "status", enabled: false, order: 1, width: 120 },
    ]);
    expect(getModuleColumnWidth(overlay, "name")).toBe(220);
    expect(getModuleColumnWidth(overlay, "status")).toBe(120);
    expect(overlay.find((column) => column.key === "status")?.enabled).toBe(false);
  });

  it("preserves local widths when server prefs omit width", () => {
    const merged = mergeModuleColumnPreferences(
      [
        { key: "name", enabled: true, order: 0 },
        { key: "status", enabled: false, order: 1 },
      ],
      [
        { key: "name", enabled: true, order: 0, width: 240 },
        { key: "status", enabled: true, order: 1, width: 110 },
      ],
    );
    expect(merged).toEqual([
      { key: "name", enabled: true, order: 0, width: 240 },
      { key: "status", enabled: false, order: 1, width: 110 },
    ]);
  });

  it("prefers local width when both sides have a width", () => {
    const merged = mergeModuleColumnPreferences(
      [{ key: "name", enabled: true, order: 0, width: 300 }],
      [{ key: "name", enabled: true, order: 0, width: 200 }],
    );
    expect(merged?.[0]?.width).toBe(200);
  });
});
