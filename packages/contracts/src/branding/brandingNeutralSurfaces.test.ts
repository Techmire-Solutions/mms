import { describe, expect, it } from "vitest";
import { buildBrandingCssVariables } from "./brandingCssVariables.js";

/**
 * Stock shadcn/ui "neutral" base: surfaces, borders, sidebar and accent carry no
 * brand hue. Only primary/secondary/ring/charts (and status fills) follow the brand.
 */
const BRANDS = [
  ["#d99b00", "#5c3412"],
  ["#036348", "#0f172a"],
  ["#7c3aed", "#facc15"],
] as const;

const LIGHT_NEUTRAL = {
  "--background": "0 0% 100%",
  "--card": "0 0% 100%",
  "--popover": "0 0% 100%",
  "--muted": "0 0% 96%",
  "--accent": "0 0% 96%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--sidebar-background": "0 0% 98%",
  "--sidebar-accent": "0 0% 94%",
  "--sidebar-border": "0 0% 90%",
} as const;

const DARK_NEUTRAL = {
  "--background": "0 0% 4%",
  "--card": "0 0% 9%",
  "--popover": "0 0% 9%",
  "--muted": "0 0% 15%",
  "--accent": "0 0% 15%",
  "--border": "0 0% 15%",
  "--input": "0 0% 15%",
  "--sidebar-background": "0 0% 9%",
  "--sidebar-accent": "0 0% 15%",
  "--sidebar-border": "0 0% 15%",
} as const;

const SATURATION = /^\d+(?:\.\d+)? (\d+(?:\.\d+)?)% /;

describe("buildBrandingCssVariables — shadcn neutral base", () => {
  for (const [primary, secondary] of BRANDS) {
    for (const [mode, expected] of [
      ["light", LIGHT_NEUTRAL],
      ["dark", DARK_NEUTRAL],
    ] as const) {
      it(`given brand ${primary} in ${mode} mode, should emit the shadcn neutral surfaces when building tokens`, () => {
        // Arrange & Act
        const vars = buildBrandingCssVariables(primary, secondary, mode);

        // Assert
        for (const [key, value] of Object.entries(expected)) {
          expect(vars[key], key).toBe(value);
        }
      });

      it(`given brand ${primary} in ${mode} mode, should emit achromatic ink tokens when building tokens`, () => {
        // Arrange & Act
        const vars = buildBrandingCssVariables(primary, secondary, mode);

        // Assert
        for (const key of [
          "--foreground",
          "--muted-foreground",
          "--accent-foreground",
          "--sidebar-foreground",
          "--sidebar-accent-foreground",
          "--sidebar-muted-foreground",
        ]) {
          expect(vars[key]?.match(SATURATION)?.[1], key).toBe("0");
        }
      });

      it(`given brand ${primary} in ${mode} mode, should use the brand primary for the active sidebar item`, () => {
        // Arrange & Act
        const vars = buildBrandingCssVariables(primary, secondary, mode);

        // Assert
        expect(vars["--sidebar-primary"]).toBe(vars["--primary"]);
        expect(vars["--sidebar-primary-foreground"]).toBe(vars["--primary-foreground"]);
        expect(vars["--sidebar-ring"]).toBe(vars["--ring"]);
      });
    }
  }
});
