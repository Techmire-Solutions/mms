/**
 * Lazy WASM WebP encoder fallback.
 *
 * Chrome/Firefox can encode WebP with `canvas.toBlob`, but Safari silently
 * returns a PNG for unsupported encoder types. The server only accepts
 * AVIF/WebP, so without this fallback every Safari/iOS avatar upload fails.
 * The wasm bundle is imported on demand and cached by the browser.
 */
let encoderPromise: Promise<typeof import("@jsquash/webp/encode")> | null = null;

function loadEncoder(): Promise<typeof import("@jsquash/webp/encode")> {
  encoderPromise ??= import("@jsquash/webp/encode");
  return encoderPromise;
}

/** Encodes RGBA pixels to WebP bytes (quality is 0..1). */
export async function encodeWebpWithWasm(
  imageData: ImageData,
  quality: number,
): Promise<Uint8Array> {
  const { default: encode } = await loadEncoder();
  const buffer = await encode(imageData, {
    quality: Math.max(0, Math.min(100, Math.round(quality * 100))),
  });
  return new Uint8Array(buffer);
}

/** Test-only reset so suites do not share the module promise. */
export function resetWebpWasmEncoderForTests(): void {
  encoderPromise = null;
}
