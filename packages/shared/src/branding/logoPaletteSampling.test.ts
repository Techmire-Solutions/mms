import { describe, expect, it } from "vitest";
import { extractDominantSwatchesFromRgba } from "./logoPaletteSampling.js";
import { deriveBrandColorsFromPalette } from "./logoBrandColors.js";

function fillSolidRgba(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): Uint8ClampedArray {
  const rgbaPixels = new Uint8ClampedArray(width * height * 4);
  for (let pixelOffset = 0; pixelOffset < rgbaPixels.length; pixelOffset += 4) {
    rgbaPixels[pixelOffset] = r;
    rgbaPixels[pixelOffset + 1] = g;
    rgbaPixels[pixelOffset + 2] = b;
    rgbaPixels[pixelOffset + 3] = a;
  }
  return rgbaPixels;
}

function fillWithCenterDisc(
  width: number,
  height: number,
  background: [number, number, number],
  disc: [number, number, number],
  radiusRatio = 0.35,
): Uint8ClampedArray {
  const rgbaPixels = new Uint8ClampedArray(width * height * 4);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * radiusRatio;

  for (let yPosition = 0; yPosition < height; yPosition += 1) {
    for (let xPosition = 0; xPosition < width; xPosition += 1) {
      const pixelOffset = (yPosition * width + xPosition) * 4;
      const inside = Math.hypot(xPosition - centerX, yPosition - centerY) <= radius;
      const [red, green, blue] = inside ? disc : background;
      rgbaPixels[pixelOffset] = red;
      rgbaPixels[pixelOffset + 1] = green;
      rgbaPixels[pixelOffset + 2] = blue;
      rgbaPixels[pixelOffset + 3] = 255;
    }
  }
  return rgbaPixels;
}

describe("extractDominantSwatchesFromRgba", () => {
  it("returns a saturated green for a solid green logo", () => {
    const rgbaPixels = fillSolidRgba(48, 48, 4, 120, 87);
    const swatches = extractDominantSwatchesFromRgba(rgbaPixels, 48, 48);
    expect(swatches.length).toBeGreaterThan(0);
    expect(swatches[0]).toMatch(/^#[0-9a-f]{6}$/);
    const derived = deriveBrandColorsFromPalette(swatches);
    expect(derived?.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(derived?.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("prefers the centre disc over a white margin", () => {
    const rgbaPixels = fillWithCenterDisc(64, 64, [255, 255, 255], [180, 30, 60]);
    const swatches = extractDominantSwatchesFromRgba(rgbaPixels, 64, 64);
    expect(swatches[0]).toBe("#b41e3c");
  });

  it("ignores fully transparent pixels", () => {
    const rgbaPixels = fillSolidRgba(32, 32, 200, 40, 40, 0);
    const swatches = extractDominantSwatchesFromRgba(rgbaPixels, 32, 32);
    expect(swatches).toHaveLength(0);
  });
});

describe("deriveBrandColorsFromPalette", () => {
  it("picks a contrasting secondary when two hues exist", () => {
    const result = deriveBrandColorsFromPalette(["#047857", "#d97706", "#ffffff"]);
    expect(result).not.toBeNull();
    expect(result!.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.secondaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.secondaryColor).not.toBe(result!.primaryColor);
  });
});
