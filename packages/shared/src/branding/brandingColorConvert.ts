/** Light or dark application chrome. */
export type BrandingThemeMode = "light" | "dark";

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export const DEFAULT_PRIMARY: HslColor = { h: 160, s: 84, l: 22 };
export const DEFAULT_SECONDARY: HslColor = { h: 42, s: 60, l: 70 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parses a hex colour into HSL components.
 */
export function hexToHslColor(hex: string): HslColor | null {
  let normalized = hex.replace(/^#/, "").trim();
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const red = parseInt(normalized.substring(0, 2), 16) / 255;
  const green = parseInt(normalized.substring(2, 4), 16) / 255;
  const blue = parseInt(normalized.substring(4, 6), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
        break;
    }
    hue /= 6;
  }

  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

/**
 * Formats HSL components as a Tailwind-compatible CSS token (`H S% L%`).
 */
export function hslColorToToken(color: HslColor): string {
  return `${color.h} ${color.s}% ${color.l}%`;
}

/**
 * Converts a hex colour to a Tailwind-compatible HSL token string.
 */
export function hexToHslToken(hex: string): string {
  return hslColorToToken(hexToHslColor(hex) ?? DEFAULT_PRIMARY);
}

const BRANDING_HEX = /^#[0-9a-f]{6}$/;

/** Coerces a user-entered hex colour to `#rrggbb` or returns fallback. */
export function normalizeBrandingHex(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback.toLowerCase();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!BRANDING_HEX.test(withHash)) return fallback.toLowerCase();
  return withHash.toLowerCase();
}

/** Converts HSL components to a `#rrggbb` hex string. */
export function hslColorToHex(color: HslColor): string {
  const hue = color.h / 360;
  const saturation = color.s / 100;
  const lightness = color.l / 100;

  const hueToRgb = (lowerBound: number, upperBound: number, hueOffset: number): number => {
    let adjustedHue = hueOffset;
    if (adjustedHue < 0) adjustedHue += 1;
    if (adjustedHue > 1) adjustedHue -= 1;
    if (adjustedHue < 1 / 6) return lowerBound + (upperBound - lowerBound) * 6 * adjustedHue;
    if (adjustedHue < 1 / 2) return upperBound;
    if (adjustedHue < 2 / 3)
      return lowerBound + (upperBound - lowerBound) * (2 / 3 - adjustedHue) * 6;
    return lowerBound;
  };

  let red: number;
  let green: number;
  let blue: number;

  if (saturation === 0) {
    red = green = blue = lightness;
  } else {
    const upperBound =
      lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const lowerBound = 2 * lightness - upperBound;
    red = hueToRgb(lowerBound, upperBound, hue + 1 / 3);
    green = hueToRgb(lowerBound, upperBound, hue);
    blue = hueToRgb(lowerBound, upperBound, hue - 1 / 3);
  }

  const toHex = (channel: number) =>
    Math.round(clamp(channel * 255, 0, 255))
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function tone(color: HslColor, deltas: { h?: number; s?: number; l?: number }): HslColor {
  return {
    h: (color.h + (deltas.h ?? 0) + 360) % 360,
    s: clamp(color.s + (deltas.s ?? 0), 0, 100),
    l: clamp(color.l + (deltas.l ?? 0), 0, 100),
  };
}
