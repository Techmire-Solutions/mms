import { describe, expect, it, vi } from "vitest";
import { canvasToOptimizedBlob, canvasToOptimizedDataUrl } from "./imageOptimization";

describe("imageOptimization (client canvas encoders)", () => {
  it("accepts the first canvas blob whose MIME type matches", async () => {
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(["image"], { type }));
    });
    const canvas = { toBlob } as unknown as HTMLCanvasElement;

    const result = await canvasToOptimizedBlob(canvas);

    expect(result?.type).toBe("image/avif");
    expect(toBlob).toHaveBeenCalledTimes(1);
  });

  it("falls through unsupported data URL encoders to WebP", () => {
    const toDataURL = vi.fn((type?: string) =>
      type === "image/avif" ? "data:image/png;base64,png" : `data:${type};base64,webp`,
    );
    const canvas = { toDataURL } as unknown as HTMLCanvasElement;

    expect(canvasToOptimizedDataUrl(canvas)).toBe("data:image/webp;base64,webp");
    expect(toDataURL).toHaveBeenCalledTimes(2);
  });
});
