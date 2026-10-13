import { describe, expect, it } from "vitest";
import {
  IMAGE_ENCODE_FORMATS,
  IMAGE_UPLOAD_PRESETS,
  imageExtensionForMime,
} from "./imageOptimizationUtils.js";

describe("imageOptimizationUtils", () => {
  it("maps supported MIME types and defaults unknown types to WebP", () => {
    expect(imageExtensionForMime("image/avif")).toBe(".avif");
    expect(imageExtensionForMime("image/webp")).toBe(".webp");
    expect(imageExtensionForMime("image/png")).toBe(".webp");
  });

  it("keeps every upload preset on the canonical format order", () => {
    expect(IMAGE_ENCODE_FORMATS).toEqual(["image/avif", "image/webp"]);
    expect(
      Object.values(IMAGE_UPLOAD_PRESETS).every(
        (preset) => preset.formats === IMAGE_ENCODE_FORMATS,
      ),
    ).toBe(true);
  });
});
