import {
  hexToHslColor,
  hslColorToHex,
  normalizeBrandingHex,
  tone,
} from "./brandingColorConvert.js";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let normalized = hex.replace(/^#/, "").trim();
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const transform = (channel: number) => {
    const scaledChannel = channel / 255;
    return scaledChannel <= 0.03928
      ? scaledChannel / 12.92
      : ((scaledChannel + 0.055) / 1.055) ** 2.4;
  };
  const red = transform(rgb.r);
  const green = transform(rgb.g);
  const blue = transform(rgb.b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * WCAG contrast ratio between two hex colours (1–21).
 */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number | null {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg === null || bg === null) return null;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAaUiContrast(ratio: number | null): boolean {
  return ratio !== null && ratio >= 3;
}

export function meetsWcagAaTextContrast(ratio: number | null): boolean {
  return ratio !== null && ratio >= 4.5;
}

/**
 * Darkens or saturates an accent until white label text meets WCAG AA (4.5:1).
 */
export function ensureAccentButtonContrast(accentHex: string): string {
  const normalized = normalizeBrandingHex(accentHex, accentHex);
  const ratio = getContrastRatio("#ffffff", normalized);
  if (ratio !== null && meetsWcagAaTextContrast(ratio)) return normalized;

  const base = hexToHslColor(normalized);
  if (!base) return normalized;

  let adjusted = base;
  for (let step = 0; step < 24; step += 1) {
    adjusted = tone(adjusted, { l: -4, s: Math.min(6, Math.max(0, 70 - adjusted.s)) });
    const candidate = hslColorToHex(adjusted);
    const candidateRatio = getContrastRatio("#ffffff", candidate);
    if (candidateRatio !== null && meetsWcagAaTextContrast(candidateRatio)) return candidate;
  }

  while (adjusted.l > 14) {
    adjusted = tone(adjusted, { l: -3, s: -5 });
    const candidate = hslColorToHex(adjusted);
    const candidateRatio = getContrastRatio("#ffffff", candidate);
    if (candidateRatio !== null && meetsWcagAaTextContrast(candidateRatio)) return candidate;
  }

  return hslColorToHex(adjusted);
}

/**
 * Automatically adjusts lightness and saturation of a hex colour so that it achieves
 * the target WCAG contrast ratio (default 4.5:1 for text, or 3.0:1 for UI) against
 * its optimal foreground (#ffffff for dark backgrounds, #0f172a for light backgrounds).
 */
export function ensureAccessibleBrandColor(
  hex: string,
  targetRatio = 4.5,
  preferredForeground?: "#ffffff" | "#0f172a",
): string {
  const normalized = normalizeBrandingHex(hex, hex);
  const base = hexToHslColor(normalized);
  if (!base) return normalized;

  const fg = preferredForeground ?? (base.l >= 55 ? "#0f172a" : "#ffffff");
  const currentRatio = getContrastRatio(fg, normalized);
  if (currentRatio !== null && currentRatio >= targetRatio) {
    return normalized;
  }

  let adjusted = base;
  if (fg === "#ffffff") {
    for (let step = 0; step < 24; step += 1) {
      adjusted = tone(adjusted, { l: -3, s: Math.min(4, Math.max(0, 70 - adjusted.s)) });
      const candidate = hslColorToHex(adjusted);
      const ratio = getContrastRatio("#ffffff", candidate);
      if (ratio !== null && ratio >= targetRatio) return candidate;
    }
  } else {
    for (let step = 0; step < 24; step += 1) {
      adjusted = tone(adjusted, { l: 3, s: Math.max(-4, Math.min(0, 30 - adjusted.s)) });
      const candidate = hslColorToHex(adjusted);
      const ratio = getContrastRatio("#0f172a", candidate);
      if (ratio !== null && ratio >= targetRatio) return candidate;
    }
  }

  return hslColorToHex(adjusted);
}
