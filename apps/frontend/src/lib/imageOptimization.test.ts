import { describe, expect, it, vi } from "vitest";
const wasmEncode = vi.hoisted(() => vi.fn());
vi.mock("@/lib/imageEncoders/wasmWebpEncoder", () => ({
  encodeWebpWithWasm: (...args: unknown[]) => wasmEncode(...args),
}));

import {
  blobHasImageSignature,
  canvasToOptimizedBlob,
  canvasToOptimizedDataUrl,
} from "./imageOptimization";

const AVIF_BYTES = new TextEncoder().encode("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1");
const WEBP_BYTES = new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8 ");
const PNG_BYTES = new TextEncoder().encode("\x89PNG\r\n\x1a\n");

function blob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as BlobPart], { type });
}

function canvasMock(
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void,
): HTMLCanvasElement {
  return { toBlob } as unknown as HTMLCanvasElement;
}

describe("blobHasImageSignature", () => {
  it("accepts AVIF and WebP containers and rejects PNG", async () => {
    await expect(blobHasImageSignature(blob(AVIF_BYTES, "image/avif"), "image/avif")).resolves.toBe(
      true,
    );
    await expect(blobHasImageSignature(blob(WEBP_BYTES, "image/webp"), "image/webp")).resolves.toBe(
      true,
    );
    await expect(blobHasImageSignature(blob(PNG_BYTES, "image/png"), "image/webp")).resolves.toBe(
      false,
    );
  });
});

describe("canvasToOptimizedBlob", () => {
  it("accepts the first native blob whose MIME and bytes match", async () => {
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(blob(type === "image/avif" ? AVIF_BYTES : WEBP_BYTES, type!));
    });

    const result = await canvasToOptimizedBlob(canvasMock(toBlob));

    expect(result?.type).toBe("image/avif");
    expect(toBlob).toHaveBeenCalledTimes(1);
  });

  it("falls through a PNG-typed AVIF attempt to native WebP", async () => {
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      // Chrome/Safari return PNG for unsupported AVIF; that must never be uploaded.
      callback(type === "image/avif" ? blob(PNG_BYTES, "image/png") : blob(WEBP_BYTES, type!));
    });

    const result = await canvasToOptimizedBlob(canvasMock(toBlob));

    expect(result?.type).toBe("image/webp");
    expect(result?.blob.type).toBe("image/webp");
  });

  it("returns null instead of a PNG when no accepted native format is available", async () => {
    const toBlob = vi.fn((callback: BlobCallback) => {
      callback(blob(PNG_BYTES, "image/png"));
    });

    await expect(canvasToOptimizedBlob(canvasMock(toBlob))).resolves.toBeNull();
  });

  it("uses the WASM WebP fallback when native AVIF/WebP both return PNG", async () => {
    wasmEncode.mockResolvedValueOnce(new Uint8Array(WEBP_BYTES));
    const toBlob = vi.fn((callback: BlobCallback) => {
      callback(blob(PNG_BYTES, "image/png"));
    });
    const canvas = {
      toBlob,
      width: 10,
      height: 10,
      getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(400) }) }),
    } as unknown as HTMLCanvasElement;

    const result = await canvasToOptimizedBlob(canvas);

    expect(wasmEncode).toHaveBeenCalledTimes(1);
    expect(result?.type).toBe("image/webp");
    expect(result?.blob.type).toBe("image/webp");
  });

  it("does not hang when the native encoder never invokes its callback", async () => {
    vi.useFakeTimers();
    try {
      const toBlob = vi.fn();
      const pending = canvasToOptimizedBlob(canvasMock(toBlob));
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("canvasToOptimizedDataUrl", () => {
  it("falls through unsupported data URL encoders to WebP", () => {
    const toDataURL = vi.fn((type?: string) =>
      type === "image/avif" ? "data:image/png;base64,png" : `data:${type};base64,webp`,
    );
    const canvas = { toDataURL } as unknown as HTMLCanvasElement;

    expect(canvasToOptimizedDataUrl(canvas)).toBe("data:image/webp;base64,webp");
    expect(toDataURL).toHaveBeenCalledTimes(2);
  });
});
