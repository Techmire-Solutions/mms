import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getContrastRatio, MAX_RESTING_TINT_BY_MODE } from "@mms/shared";

/**
 * The tint-contract case reads every source file synchronously. It takes well under a second on
 * its own, but under full-suite load the shared disk can push it toward the 15s default, so it
 * gets an explicit budget instead of flaking. Every other case here is pure arithmetic.
 */
const SOURCE_SCAN_TIMEOUT_MS = 60_000;

/**
 * Executable form of the WCAG AA contrast contract documented in `src/index.css`.
 *
 * The default light palette previously failed AA across the board: every semantic
 * token was a mid-tone chosen for hue, not for contrast. Each token serves three
 * roles and the value has to satisfy all of them:
 *
 *   1. a solid fill — `bg-primary` with `text-primary-foreground` on it;
 *   2. text/icons — `text-primary` on `--card` / `--background`;
 *   3. text/icons on the token's OWN low tint — `bg-primary/10 text-primary`,
 *      the standard chip pattern (188 usages at /10, plus /15 and /20 variants).
 *
 * (1) and (2) reduce to the same luminance constraint; (3) is the strictest,
 * because a tint of the token lightens the surface the token is read against.
 *
 * Contrast uses the repository's own `getContrastRatio()`
 * (`packages/shared/src/brandingColorContrast.ts`) rather than a re-implementation,
 * so this test and the runtime branding/contrast tooling cannot drift.
 */

const INDEX_CSS = path.resolve(import.meta.dirname, "../index.css");

const AA_TEXT = 4.5;
/** WCAG 1.4.11 non-text contrast, for focus indicators and UI boundaries. */
const AA_NON_TEXT = 3;
/**
 * Strongest same-token tint used behind same-token text AT REST, per theme.
 *
 * Single-sourced from `@mms/shared`. It used to restate the number, so all three
 * copies drifted together when the dark value was measured wrong (`0.10`, from the
 * false claim that "dark — only `dark:bg-<role>/10` exists; there is no
 * `dark:bg-<role>/15`"): `dark:bg-info/15` and `dark:bg-<role>/20` both existed. The
 * design contract (`src/index.css`) is `/15` in both modes.
 */
const MAX_RESTING_TINT = MAX_RESTING_TINT_BY_MODE;

type Hsl = [number, number, number];

/** HSL components from the declarations inside `selector { … }`. */
function readTokenBlock(css: string, selector: string): Record<string, Hsl> {
  // Anchor to the start of a line. A bare `indexOf(".dark")` finds the
  // `@custom-variant dark (&:is(.dark *))` declaration near the top of the file
  // and then reads the wrong block entirely.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const located = new RegExp(`^\\s*${escaped}\\s*\\{`, "m").exec(css);
  if (!located) throw new Error(`Selector ${selector} not found in index.css`);
  const open = css.indexOf("{", located.index);
  const close = css.indexOf("}", open);
  const block = css.slice(open + 1, close);

  const tokens: Record<string, Hsl> = {};
  for (const line of block.split("\n")) {
    const declaration = /^\s*--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/.exec(line);
    if (!declaration) continue;
    tokens[declaration[1]] = [
      Number(declaration[2]),
      Number(declaration[3]),
      Number(declaration[4]),
    ];
  }
  return tokens;
}

function hslToHex([h, s, l]: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/** `bg-<token>/<alpha>` composited over `base` — how Tailwind renders a tint. */
function tintOver(tintHex: string, baseHex: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const composited = [0, 1, 2].map((i) =>
    Math.round(channel(tintHex, i) * alpha + channel(baseHex, i) * (1 - alpha)),
  );
  return `#${composited.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const css = readFileSync(INDEX_CSS, "utf-8");
const light = readTokenBlock(css, ":root");
const dark = readTokenBlock(css, ".dark");

/** Roles that must work as a fill, as text, and as text on their own tint. */
const SEMANTIC_ROLES = ["primary", "destructive", "success", "warning", "info"] as const;

function hex(tokens: Record<string, Hsl>, name: string): string {
  const token = tokens[name];
  if (!token) throw new Error(`Token --${name} is missing`);
  return hslToHex(token);
}

function assertAtLeast(actual: number | null, minimum: number, label: string): void {
  expect(actual, `${label} is ${actual?.toFixed(2)}:1, needs ${minimum}:1`).toBeGreaterThanOrEqual(
    minimum,
  );
}

describe.each([
  ["light", light, ["card", "background"] as const, MAX_RESTING_TINT.light],
  ["dark", dark, ["card", "background"] as const, MAX_RESTING_TINT.dark],
])("design tokens — %s theme WCAG AA", (_themeName, tokens, surfaces, maxTint) => {
  it.each(SEMANTIC_ROLES)("--%s works as text on every surface", (role) => {
    for (const surface of surfaces) {
      assertAtLeast(
        getContrastRatio(hex(tokens, role), hex(tokens, surface)),
        AA_TEXT,
        `--${role} as text on --${surface}`,
      );
    }
  });

  it.each(SEMANTIC_ROLES)("--%s works as a solid fill", (role) => {
    // `bg-<role> text-<role>-foreground` is how the solid Button variants work.
    assertAtLeast(
      getContrastRatio(hex(tokens, `${role}-foreground`), hex(tokens, role)),
      AA_TEXT,
      `--${role}-foreground on --${role}`,
    );
  });

  it.each(SEMANTIC_ROLES)("--%s stays legible on its own tint", (role) => {
    // The chip/badge pattern: `bg-<role>/10 text-<role>`.
    const roleHex = hex(tokens, role);
    for (const surface of surfaces) {
      const tinted = tintOver(roleHex, hex(tokens, surface), maxTint);
      assertAtLeast(
        getContrastRatio(roleHex, tinted),
        AA_TEXT,
        `--${role} on bg-${role}/${Math.round(maxTint * 100)} over --${surface}`,
      );
    }
  });

  it("keeps --ring visible enough to serve as a focus indicator", () => {
    // Non-text contrast only (WCAG 1.4.11).
    assertAtLeast(
      getContrastRatio(hex(tokens, "ring"), hex(tokens, "card")),
      AA_NON_TEXT,
      "--ring on --card",
    );
  });

  it("keeps --muted-foreground legible on --card, --muted and --background", () => {
    // --muted is a real surface (table headers, zebra rows), and a value tuned
    // only against white is 3.95:1 there.
    for (const surface of ["card", "muted", "background"] as const) {
      assertAtLeast(
        getContrastRatio(hex(tokens, "muted-foreground"), hex(tokens, surface)),
        AA_TEXT,
        "--muted-foreground on --" + surface,
      );
    }
  });
});

describe("design tokens — tint strength contract", () => {
  /**
   * `src/index.css` states the rule in prose — "tints stronger than `/15` … must use
   * `-foreground` or a lighter tint, because no single hue satisfies every step" — and
   * nothing checked it, so eight call sites sat at `/20` behind the same token's text.
   * This makes the prose executable.
   *
   * EVERY interaction state is in scope, and that was measured rather than assumed: same-token
   * text on its own tint scores 4.50:1 (light) / 4.51:1 (dark) at `/15`, but **4.13 / 4.12 at
   * `/20`** and 3.80 at `/25`. WCAG 1.4.3 applies to hovered text too, so `hover:bg-<token>/20`
   * behind `text-<token>` is a real drop below AA — not an exemption.
   */
  it(
    "no tint stronger than the bound carries the same token as text, in any state",
    () => {
      const maxAlpha = Math.round(MAX_RESTING_TINT_BY_MODE.light * 100);
      /**
       * Scoped to the fill tokens whose parent surface is `--card` / `--background` — the
       * surfaces this bound is solved against. Excluded, with reasons:
       *   - `*-foreground`: label tokens used as subtle overlays inside the DARK command
       *     palette, where the composited surface is dark and the light-surface maths
       *     behind this bound does not apply;
       *   - `sidebar-*`: they live on the dark sidebar, which has its own fitted pair
       *     (`--sidebar-foreground` / `--sidebar-muted-foreground`).
       */
      const isCovered = (token: string) =>
        !token.endsWith("-foreground") && !token.startsWith("sidebar-");

      /** Every candidate class in the literal — all interaction states are in scope. */
      const candidateClasses = (literal: string) => literal.slice(1, -1).split(/\s+/);

      const offenders: string[] = [];

      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
          if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
          return [full];
        });

      for (const file of walk(path.resolve(import.meta.dirname, ".."))) {
        const relative = path.relative(path.resolve(import.meta.dirname, "../.."), file);
        for (const literal of readFileSync(file, "utf-8").matchAll(/"[^"\n]*"/g)) {
          const classes = candidateClasses(literal[0]);
          const textTokens = classes
            .map((className) => /(?:\w+:)*text-([a-z-]+)$/.exec(className)?.[1])
            .filter((token) => token !== undefined);

          for (const className of classes) {
            const tint = /(?:\w+:)*bg-([a-z-]+)\/(\d+)$/.exec(className);
            if (!tint) continue;
            const [, token, alphaText] = tint;
            if (!isCovered(token) || Number(alphaText) <= maxAlpha) continue;
            if (textTokens.includes(token)) {
              offenders.push(`${relative} → ${className} with text-${token}`);
            }
          }
        }
      }

      expect(
        offenders,
        `Resting tints stronger than /${maxAlpha} behind the same token's text:\n${offenders.join("\n")}`,
      ).toEqual([]);
    },
    SOURCE_SCAN_TIMEOUT_MS,
  );
});

describe("design tokens — typography legibility floor", () => {
  it("keeps the sub-xs scale at or above 10px", () => {
    // 9px and 10px steps were unreadable, and much worse for Nastaliq.
    const sizeOf = (token: string) => {
      const match = new RegExp(`--text-${token}:\\s*([\\d.]+)rem`).exec(css);
      if (!match) throw new Error(`--text-${token} is missing`);
      return Number(match[1]) * 16;
    };
    expect(sizeOf("4xs")).toBeGreaterThanOrEqual(10);
    expect(sizeOf("3xs")).toBeGreaterThanOrEqual(11);
    expect(sizeOf("2xs")).toBeGreaterThanOrEqual(12);
  });

  it("declares the scale in the namespace Tailwind v4 consumes", () => {
    // These were `--font-size-*`, which Tailwind v4 does not consume: no utility
    // was emitted for any of the 217 `text-2xs`/`3xs`/`4xs` call sites, and nothing
    // failed. The same invariant is enforced pre-build by
    // `scripts/check-code-norms.mjs`; this asserts it from the consumer side.
    expect(css).not.toMatch(/--font-size-[a-z0-9]+:/);
    expect(css).not.toMatch(/--line-height-[a-z0-9]+:/);
    expect(css).not.toMatch(/--box-shadow-[a-z0-9]+:/);
  });
});

describe("design tokens — locale typography", () => {
  it("gives Urdu the Nastaliq leading the design contract requires", () => {
    // Nastaliq stacks letterforms and has deep descenders. The contract in
    // `mms-ui-ux-design` §2 asks for 2.2; the stylesheet had drifted to 1.8.
    const urduRule = /:lang\(ur\)[^{]*\{[^}]*line-height:\s*([\d.]+)/.exec(css);
    expect(urduRule, "no line-height declared for :lang(ur)").not.toBeNull();
    expect(Number(urduRule![1])).toBeGreaterThanOrEqual(2.2);
  });

  it("does not force the Amiri serif on locales that never load it", () => {
    // Amiri is fetched only for ar/ur (`lib/localeFonts.ts`). Naming it in the
    // global `:root` made English and Persian brand text fall back to a generic
    // serif — the mobile header, sidebar brand and login headline.
    const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(rootBlock, "no :root block").not.toBeNull();
    expect(
      rootBlock![1],
      "--font-display names Amiri in :root, where en/fa cannot load it",
    ).not.toMatch(/--font-display:[^;]*Amiri/);
  });

  it("scopes the Amiri display stack to the locales that load it", () => {
    expect(css).toMatch(/\[lang="ar"\][^{]*\{[^}]*--font-display:[^;]*Amiri/);
    expect(css).toMatch(/\[lang="ur"\][^{]*\{[^}]*--font-display:[^;]*Amiri/);
  });
});
