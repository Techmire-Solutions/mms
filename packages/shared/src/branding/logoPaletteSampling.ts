import { hexToHslColor } from "./brandingTheme.js";

/** Options for {@link extractDominantSwatchesFromRgba}. */
export interface LogoPaletteSamplingOptions {
  /** Maximum swatches returned (after deduplication). */
  maxSwatches?: number;
  /** Alpha threshold (0–255); more transparent pixels are skipped. */
  minAlpha?: number;
  /** Bits per channel when quantizing similar pixels (4 = coarse, 5 = finer). */
  quantizeBits?: number;
  /** Drop low-chroma pixels during sampling (0–100 HSL saturation). */
  minChromaSaturation?: number;
  /** Drop very dark / very light pixels during sampling (0–100 HSL lightness). */
  minLightness?: number;
  maxLightness?: number;
  /** Flatten partial transparency onto this hex (typical for PNG logos on white). */
  flattenOnto?: string;
  /** 0–1 — boosts pixels toward the image centre (logos often have empty margins). */
  centerWeight?: number;
  /** Minimum RGB distance between returned swatches (dedupe near-duplicates). */
  minSwatchDistance?: number;
}

const DEFAULT_SAMPLING: Required<LogoPaletteSamplingOptions> = {
  maxSwatches: 12,
  minAlpha: 32,
  quantizeBits: 5,
  minChromaSaturation: 8,
  minLightness: 8,
  maxLightness: 92,
  flattenOnto: "#ffffff",
  centerWeight: 0.35,
  minSwatchDistance: 42,
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface ColorBucket {
  weight: number;
  r: number;
  g: number;
  b: number;
}

function parseHexRgb(hex: string): Rgb | null {
  let raw = hex.trim().replace(/^#/, "");
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function quantizeChannel(value: number, bits: number): number {
  const levels = 1 << bits;
  const step = 255 / (levels - 1);
  return Math.round(Math.round(value / step) * step);
}

function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function flattenPixel(r: number, g: number, b: number, a: number, background: Rgb): Rgb {
  const alpha = a / 255;
  return {
    r: r * alpha + background.r * (1 - alpha),
    g: g * alpha + background.g * (1 - alpha),
    b: b * alpha + background.b * (1 - alpha),
  };
}

/** Saturation-aware weight — vivid brand hues outrank grey margins. */
function chromaWeight(r: number, g: number, b: number): number {
  const hsl = hexToHslColor(rgbToHex(r, g, b));
  if (!hsl) return 1;
  const saturationFactor = 0.35 + (hsl.s / 100) * 0.65;
  const midLightness = 1 - Math.min(1, Math.abs(hsl.l - 45) / 55);
  return saturationFactor * (0.7 + midLightness * 0.3);
}

function isSampleNeutral(
  r: number,
  g: number,
  b: number,
  samplingOptions: Required<LogoPaletteSamplingOptions>,
): boolean {
  const hsl = hexToHslColor(rgbToHex(r, g, b));
  if (!hsl) return true;
  if (hsl.s < samplingOptions.minChromaSaturation) return true;
  if (hsl.l < samplingOptions.minLightness || hsl.l > samplingOptions.maxLightness) return true;
  return false;
}

function centerPixelWeight(
  x: number,
  y: number,
  width: number,
  height: number,
  centerWeight: number,
): number {
  if (centerWeight <= 0) return 1;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  const dist = Math.hypot(x - cx, y - cy);
  return 1 + centerWeight * (1 - dist / maxDist);
}

export interface LogoDominantSwatch {
  hex: string;
  weight: number;
  percentage: number;
}

/**
 * Counts weighted, quantized RGB buckets from raw RGBA canvas data.
 * Returns ranked dominant swatches with their proportional percentage.
 */
export function extractDominantWeightedSwatchesFromRgba(
  rgbaPixels: Uint8ClampedArray,
  width: number,
  height: number,
  options?: LogoPaletteSamplingOptions,
): LogoDominantSwatch[] {
  const samplingOptions = { ...DEFAULT_SAMPLING, ...options };
  const background = parseHexRgb(samplingOptions.flattenOnto) ?? { r: 255, g: 255, b: 255 };
  const buckets = new Map<string, ColorBucket>();

  for (let yPosition = 0; yPosition < height; yPosition += 1) {
    for (let xPosition = 0; xPosition < width; xPosition += 1) {
      const pixelOffset = (yPosition * width + xPosition) * 4;
      const alpha = rgbaPixels[pixelOffset + 3];
      if (alpha < samplingOptions.minAlpha) continue;

      const flat = flattenPixel(
        rgbaPixels[pixelOffset],
        rgbaPixels[pixelOffset + 1],
        rgbaPixels[pixelOffset + 2],
        alpha,
        background,
      );
      if (isSampleNeutral(flat.r, flat.g, flat.b, samplingOptions)) continue;

      const qr = quantizeChannel(flat.r, samplingOptions.quantizeBits);
      const qg = quantizeChannel(flat.g, samplingOptions.quantizeBits);
      const qb = quantizeChannel(flat.b, samplingOptions.quantizeBits);
      const key = `${qr}|${qg}|${qb}`;

      const pixelWeight =
        centerPixelWeight(xPosition, yPosition, width, height, samplingOptions.centerWeight) *
        chromaWeight(flat.r, flat.g, flat.b);

      const existing = buckets.get(key);
      if (existing) {
        existing.weight += pixelWeight;
        existing.r += flat.r * pixelWeight;
        existing.g += flat.g * pixelWeight;
        existing.b += flat.b * pixelWeight;
      } else {
        buckets.set(key, {
          weight: pixelWeight,
          r: flat.r * pixelWeight,
          g: flat.g * pixelWeight,
          b: flat.b * pixelWeight,
        });
      }
    }
  }

  const ranked = [...buckets.values()]
    .map((bucket) => {
      const rgb: Rgb = {
        r: bucket.r / bucket.weight,
        g: bucket.g / bucket.weight,
        b: bucket.b / bucket.weight,
      };
      return { weight: bucket.weight, rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
    })
    .sort((a, b) => b.weight - a.weight);

  const picked: Rgb[] = [];
  const dominant: LogoDominantSwatch[] = [];
  let totalPickedWeight = 0;

  for (const entry of ranked) {
    if (dominant.length >= samplingOptions.maxSwatches) break;
    const tooClose = picked.some(
      (rgb) => rgbDistance(rgb, entry.rgb) < samplingOptions.minSwatchDistance,
    );
    if (tooClose) continue;
    picked.push(entry.rgb);
    dominant.push({ hex: entry.hex, weight: entry.weight, percentage: 0 });
    totalPickedWeight += entry.weight;
  }

  const safeTotal = Math.max(1, totalPickedWeight);
  return dominant.map((item) => ({
    ...item,
    percentage: Math.max(1, Math.round((item.weight / safeTotal) * 100)),
  }));
}

/**
 * Counts weighted, quantized RGB buckets from raw RGBA canvas data.
 * Designed for logo marks: ignores transparent margins, down-weights neutrals,
 * and favours saturated centre pixels over flat backgrounds.
 */
export function extractDominantSwatchesFromRgba(
  rgbaPixels: Uint8ClampedArray,
  width: number,
  height: number,
  options?: LogoPaletteSamplingOptions,
): string[] {
  return extractDominantWeightedSwatchesFromRgba(rgbaPixels, width, height, options).map(
    (s) => s.hex,
  );
}
