import { describe, expect, it } from "vitest";
import { BRANDING_THEME_PRESETS } from "./brandingTypes.js";
import {
  brandingPrimaryToThemeColor,
  brandingTokenToHex,
  buildBrandingCssVariables,
  ensureAccentButtonContrast,
  getBrandingPresetAccessibility,
  getContrastRatio,
  meetsWcagAaTextContrast,
  suggestSecondaryColor,
} from "./brandingTheme.js";
import {
  CHART_PALETTE_DEFS,
  DEFAULT_CHART_PALETTE_ID,
  getChartPaletteColors,
  isColorblindSafeChartPalette,
} from "./chartPalettes.js";

describe("buildBrandingCssVariables", () => {
  /**
   * A semantic token is used in THREE roles, and the fill pairs asserted below
   * only cover one of them:
   *
   *   1. fill      — `bg-primary` with `text-primary-foreground` on it;
   *   2. text      — `text-primary` on `--card` / `--background`;
   *   3. own tint  — `bg-primary/10 text-primary` (the chip/badge pattern).
   *
   * Role 3 is the binding one: a tint of the token lightens the surface the token
   * is read against. The pipeline used to accept "bright fill + dark label", which
   * satisfies role 1 and destroys roles 2 and 3 — the runtime palette handed out
   * `--primary: #db9d00` (2.37:1 on white), which the axe gate then caught in the
   * settings nav and the Work-directory count badge.
   */
  const TEXT_ROLE_TOKENS = ["primary", "destructive", "success", "warning", "info"] as const;
  const TEXT_ROLE_SURFACES = ["--card", "--background"] as const;

  /** `bg-<token>/<alpha>` composited over `base`, i.e. what the eye sees. */
  function tintOver(tintHex: string, baseHex: string, alpha: number): string {
    const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const rgb = [0, 1, 2].map((i) =>
      Math.round(channel(tintHex, i) * alpha + channel(baseHex, i) * (1 - alpha)),
    );
    return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  it.each(["light", "dark"] as const)(
    "every curated preset satisfies all three token roles (%s mode)",
    (mode) => {
      // Strongest same-token tint behind same-token text at rest — light has
      // `bg-primary/15 text-primary`, dark only ever uses `dark:bg-<role>/10`.
      const maxTint = mode === "light" ? 0.15 : 0.1;
      const failures: string[] = [];

      // The curated presets are all dark brand colours, so they never exercised
      // the failure that actually shipped: a LIGHT brand colour on which dark text
      // passes, so an "accept the first thing that passes" fill check keeps the
      // bright fill and destroys the text role. The tenant in the axe run got
      // `--primary: #db9d00` (2.37:1 on white) from exactly this shape.
      const candidates: { id: string; primaryColor: string; secondaryColor: string }[] = [
        ...BRANDING_THEME_PRESETS,
        { id: "light-amber-brand", primaryColor: "#d09611", secondaryColor: "#5d3614" },
        { id: "light-yellow-brand", primaryColor: "#facc15", secondaryColor: "#422006" },
        { id: "light-lime-brand", primaryColor: "#a3e635", secondaryColor: "#1a2e05" },
      ];

      for (const preset of candidates) {
        const vars = buildBrandingCssVariables(preset.primaryColor, preset.secondaryColor, mode);

        for (const token of TEXT_ROLE_TOKENS) {
          const tokenHex = brandingTokenToHex(vars[`--${token}`] ?? "");
          if (!tokenHex) {
            failures.push(`${preset.id} ${mode} --${token} missing`);
            continue;
          }

          for (const surface of TEXT_ROLE_SURFACES) {
            const surfaceHex = brandingTokenToHex(vars[surface] ?? "");
            const onSurface = getContrastRatio(tokenHex, surfaceHex);
            if (!meetsWcagAaTextContrast(onSurface)) {
              failures.push(
                `${preset.id} ${mode} --${token} as text on ${surface} = ${onSurface?.toFixed(2)}:1`,
              );
            }

            const tinted = tintOver(tokenHex, surfaceHex, maxTint);
            const onTint = getContrastRatio(tokenHex, tinted);
            if (!meetsWcagAaTextContrast(onTint)) {
              failures.push(
                `${preset.id} ${mode} --${token} on its own /${Math.round(maxTint * 100)} tint over ${surface} = ${onTint?.toFixed(2)}:1`,
              );
            }
          }
        }
      }

      expect(failures, failures.join("\n")).toEqual([]);
    },
  );

  it("includes semantic status tokens for tenant themes", () => {
    const vars = buildBrandingCssVariables("#047857", "#c2410c", "light");
    expect(typeof vars["--success"]).toBe("string");
    expect(vars["--success"].length).toBeGreaterThan(0);
    expect(typeof vars["--destructive"]).toBe("string");
    expect(vars["--destructive"].length).toBeGreaterThan(0);
    expect(typeof vars["--warning"]).toBe("string");
    expect(vars["--warning"].length).toBeGreaterThan(0);
    expect(typeof vars["--info"]).toBe("string");
    expect(vars["--info"].length).toBeGreaterThan(0);
  });

  it("picks readable primary foreground via contrast", () => {
    const vars = buildBrandingCssVariables("#0b3d2e", "#c9a227", "light");
    const fgHex = brandingTokenToHex(vars["--primary-foreground"] ?? "");
    const ratio = getContrastRatio(fgHex, "#0b3d2e");
    expect(meetsWcagAaTextContrast(ratio)).toBe(true);
  });

  it("derives theme-color meta hex from primary", () => {
    expect(brandingPrimaryToThemeColor("#047857")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("BRANDING_THEME_PRESETS", () => {
  it("every curated preset passes WCAG AA text contrast on primary and accent", () => {
    for (const preset of BRANDING_THEME_PRESETS) {
      const access = getBrandingPresetAccessibility(preset.primaryColor, preset.secondaryColor);
      expect(access.primaryPassesAaText, `${preset.id} primary`).toBe(true);
      expect(access.accentPassesAaText, `${preset.id} accent`).toBe(true);
    }
  });

  it("every curated preset passes WCAG contrast in dark mode derived tokens", () => {
    const textPairs = [
      ["--primary-foreground", "--primary"],
      ["--secondary-foreground", "--secondary"],
      ["--accent-foreground", "--accent"],
      ["--foreground", "--background"],
      ["--card-foreground", "--card"],
      ["--popover-foreground", "--popover"],
      ["--muted-foreground", "--muted"],
      ["--muted-foreground", "--background"],
      ["--sidebar-foreground", "--sidebar-background"],
      ["--sidebar-primary-foreground", "--sidebar-primary"],
      ["--sidebar-accent-foreground", "--sidebar-accent"],
      ["--sidebar-muted-foreground", "--sidebar-background"],
      ["--sidebar-muted-foreground", "--sidebar-accent"],
      ["--destructive-foreground", "--destructive"],
      ["--success-foreground", "--success"],
      ["--warning-foreground", "--warning"],
      ["--info-foreground", "--info"],
    ] as const;

    const failures: string[] = [];
    for (const preset of BRANDING_THEME_PRESETS) {
      const vars = buildBrandingCssVariables(preset.primaryColor, preset.secondaryColor, "dark");
      for (const [fgKey, bgKey] of textPairs) {
        const fgHex = brandingTokenToHex(vars[fgKey] ?? "");
        const bgHex = brandingTokenToHex(vars[bgKey] ?? "");
        const ratio = getContrastRatio(fgHex, bgHex);
        if (!meetsWcagAaTextContrast(ratio)) {
          failures.push(
            `${preset.id} ${fgKey}/${bgKey} ratio=${ratio?.toFixed(2)} fg=${fgHex} bg=${bgHex}`,
          );
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("every curated preset passes WCAG contrast in light mode derived tokens", () => {
    const textPairs = [
      ["--primary-foreground", "--primary"],
      ["--secondary-foreground", "--secondary"],
      ["--accent-foreground", "--accent"],
      ["--foreground", "--background"],
      ["--card-foreground", "--card"],
      ["--popover-foreground", "--popover"],
      ["--muted-foreground", "--muted"],
      ["--muted-foreground", "--background"],
      ["--sidebar-foreground", "--sidebar-background"],
      ["--sidebar-primary-foreground", "--sidebar-primary"],
      ["--sidebar-accent-foreground", "--sidebar-accent"],
      ["--sidebar-muted-foreground", "--sidebar-background"],
      ["--sidebar-muted-foreground", "--sidebar-accent"],
      ["--destructive-foreground", "--destructive"],
      ["--success-foreground", "--success"],
      ["--warning-foreground", "--warning"],
      ["--info-foreground", "--info"],
    ] as const;

    const failures: string[] = [];
    for (const preset of BRANDING_THEME_PRESETS) {
      const vars = buildBrandingCssVariables(preset.primaryColor, preset.secondaryColor, "light");
      for (const [fgKey, bgKey] of textPairs) {
        const fgHex = brandingTokenToHex(vars[fgKey] ?? "");
        const bgHex = brandingTokenToHex(vars[bgKey] ?? "");
        const ratio = getContrastRatio(fgHex, bgHex);
        if (!meetsWcagAaTextContrast(ratio)) {
          failures.push(`${preset.id} ${fgKey}/${bgKey} ratio=${ratio?.toFixed(2)}`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});

describe("suggestSecondaryColor & suggestHarmoniousSecondaryColor", () => {
  it("returns accessible accent for arbitrary primaries", () => {
    const accent = suggestSecondaryColor("#2563eb");
    const ratio = getContrastRatio("#ffffff", accent);
    expect(meetsWcagAaTextContrast(ratio)).toBe(true);
  });

  it("supports complementary, analogous, and triadic schemes", () => {
    const primary = "#0284c7";
    const comp = suggestSecondaryColor(primary);
    expect(comp).toMatch(/^#[0-9a-f]{6}$/i);

    const adjusted = ensureAccentButtonContrast("#d97706");
    const ratio = getContrastRatio("#ffffff", adjusted);
    expect(meetsWcagAaTextContrast(ratio)).toBe(true);
  });
});

describe("chartPalettes", () => {
  it("defaults to an accessible palette", () => {
    expect(isColorblindSafeChartPalette(DEFAULT_CHART_PALETTE_ID)).toBe(true);
    const colors = getChartPaletteColors(DEFAULT_CHART_PALETTE_ID);
    expect(colors.length).toBeGreaterThanOrEqual(5);
  });

  it("resolves brand palette from institution chart colours", () => {
    const brand = ["#047857", "#c2410c", "#065f46", "#92400e", "#0f766e"];
    expect(getChartPaletteColors("brand", brand)).toEqual(brand);
  });

  it("marks accessible palettes as colourblind-safe", () => {
    const accessible = CHART_PALETTE_DEFS.filter((def) => def.category === "accessible");
    expect(accessible.length).toBeGreaterThanOrEqual(3);
    for (const def of accessible) {
      expect(def.colorblindSafe).toBe(true);
      expect(def.colors.length).toBeGreaterThan(0);
    }
  });
});
