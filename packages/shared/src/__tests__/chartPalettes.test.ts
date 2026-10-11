import { describe, expect, it } from "vitest";
import {
  CHART_PALETTE_DEFS,
  DEFAULT_CHART_PALETTE_ID,
  getStaticChartPaletteMap,
  getChartPaletteColors,
  isColorblindSafeChartPalette,
  listChartPalettesByCategory,
} from "../chartPalettes.js";

describe("chartPalettes", () => {
  it("contains expected default chart palette ID", () => {
    expect(DEFAULT_CHART_PALETTE_ID).toBe("accessibleColorblind");
  });

  it("lists accessible colorblind-safe palettes", () => {
    const accessible = listChartPalettesByCategory("accessible");
    expect(accessible.length).toBeGreaterThan(0);
    expect(accessible.every((p) => p.colorblindSafe)).toBe(true);
  });

  it("identifies colorblind-safe palette IDs correctly", () => {
    expect(isColorblindSafeChartPalette("accessibleColorblind")).toBe(true);
    expect(isColorblindSafeChartPalette("tolVibrant")).toBe(true);
    expect(isColorblindSafeChartPalette("emeraldForest")).toBe(false);
    expect(isColorblindSafeChartPalette("unknown_palette")).toBe(false);
  });

  it("resolves dynamic brand colors when id is brand", () => {
    const customBrandColors = ["#112233", "#445566"];
    const resolved = getChartPaletteColors("brand", customBrandColors);
    expect(resolved).toEqual(customBrandColors);
  });

  it("falls back to default palette when palette ID is unknown or empty", () => {
    const fallback = getChartPaletteColors("nonexistent_id");
    const defaultDef = CHART_PALETTE_DEFS.find((d) => d.id === DEFAULT_CHART_PALETTE_ID);
    expect(fallback).toEqual(defaultDef?.colors);
  });

  it("generates a static palette map excluding dynamic brand palette", () => {
    const staticMap = getStaticChartPaletteMap();
    expect(Array.isArray(staticMap.accessibleColorblind)).toBe(true);
    expect(staticMap.accessibleColorblind.length).toBeGreaterThan(0);
    expect(staticMap.brand).toBeUndefined();
  });
});
