import {
  DEFAULT_PRIMARY,
  hexToHslColor,
  hslColorToHex,
  tone,
  type HslColor,
} from "./brandingColorConvert.js";

/** Tailwind HSL token → CSS `hsl()` colour. */
export function brandingTokenToCss(token: string): string {
  return `hsl(${token.replace(/ /g, ", ")})`;
}

function parseHslToken(token: string): HslColor | null {
  const match = token.trim().match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

/** Tailwind HSL token → `#rrggbb` (for Recharts / canvas APIs). */
export function brandingTokenToHex(token: string, fallback = "#047857"): string {
  const parsed = parseHslToken(token);
  return parsed ? hslColorToHex(parsed) : fallback;
}

/** Hex suitable for `<meta name="theme-color">` from institution primary. */
export function brandingPrimaryToThemeColor(primaryHex: string): string {
  const primary = hexToHslColor(primaryHex) ?? DEFAULT_PRIMARY;
  return hslColorToHex(tone(primary, { l: -4 }));
}
