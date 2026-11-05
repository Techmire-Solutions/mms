import {
  IMAGE_ENCODE_FORMATS,
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
  IMAGE_UPLOAD_MAX_OUTPUT_BYTES,
  IMAGE_UPLOAD_PRESETS,
  imageExtensionForMime,
  type ImageUploadPurpose,
} from "@mms/shared";
import { encodeWebpWithWasm } from "@/lib/imageEncoders/wasmWebpEncoder";
import { ImageUploadError } from "@/lib/imageUploadErrors";

/** A stalled native encoder must not leave the upload spinner pending forever. */
const ENCODE_TIMEOUT_MS = 8_000;
const IMAGE_SOURCE_EXTENSIONS = /\.(?:jpe?g|png|webp|avif|gif|bmp|heic|heif|tiff?)$/i;
const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  if (start < 0 || end > bytes.length || end <= start) return "";
  return String.fromCharCode(...bytes.slice(start, end));
}

/** True when the file is an image either by MIME type or by extension (HEIC often has an empty type). */
export function isSupportedImageSource(file: File): boolean {
  return file.type.toLowerCase().startsWith("image/") || IMAGE_SOURCE_EXTENSIONS.test(file.name);
}

export function isHeicImageFile(file: File): boolean {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || /\.(?:heic|heif)$/i.test(file.name);
}

/** Validates a blob's magic bytes so a PNG masquerading as WebP never reaches the server. */
export async function blobHasImageSignature(blob: Blob, type: string): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  if (type === "image/webp") {
    return ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP";
  }
  if (type === "image/avif") {
    if (ascii(head, 4, 8) !== "ftyp") return false;
    const majorBrand = ascii(head, 8, 12);
    if (majorBrand === "avif" || majorBrand === "avis") return true;
    // ISO-BMFF allows a generic major brand with avif/avis in compatible brands.
    const limit = Math.min(head.length, 64);
    for (let offset = 16; offset + 4 <= limit; offset += 4) {
      const brand = ascii(head, offset, offset + 4);
      if (brand === "avif" || brand === "avis") return true;
    }
  }
  return false;
}

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
  timeoutMs = ENCODE_TIMEOUT_MS,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      canvas.toBlob((blob) => finish(blob), type, quality);
    } catch {
      finish(null);
    }
  });
}

async function encodeCanvasWebpWithWasm(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; type: string } | null> {
  if (typeof canvas.getContext !== "function") return null;
  const context = canvas.getContext("2d");
  if (!context) return null;
  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const bytes = await encodeWebpWithWasm(imageData, quality);
    const blob = new Blob([bytes as BlobPart], { type: "image/webp" });
    if (await blobHasImageSignature(blob, "image/webp")) {
      return { blob, type: "image/webp" };
    }
  } catch {
    // The wasm fallback is best-effort; the caller reports encode_failed.
  }
  return null;
}

/**
 * Encodes a canvas to AVIF → WebP, validating both the declared type and the
 * container signature. Never returns the PNG that unsupported browsers emit
 * when asked for AVIF/WebP — the server only accepts AVIF/WebP.
 */
export async function canvasToOptimizedBlob(
  canvas: HTMLCanvasElement,
  quality = 0.82,
  formats: readonly string[] = IMAGE_ENCODE_FORMATS,
): Promise<{ blob: Blob; type: string } | null> {
  if (typeof canvas.toBlob !== "function") return null;

  for (const type of formats) {
    const blob = await canvasToBlobAsync(canvas, type, quality);
    if (blob && blob.type === type && (await blobHasImageSignature(blob, type))) {
      return { blob, type };
    }
  }

  // Native encoders can be missing (Safari returns PNG for both AVIF and WebP).
  if (formats.includes("image/webp")) {
    const wasm = await encodeCanvasWebpWithWasm(canvas, quality);
    if (wasm) return wasm;
  }
  return null;
}

/**
 * Encodes a canvas to an optimized data URL (AVIF → WebP). Returns "" when the
 * browser cannot produce an accepted format instead of a PNG data URL.
 */
export function canvasToOptimizedDataUrl(canvas: HTMLCanvasElement, quality = 0.82): string {
  for (const type of IMAGE_ENCODE_FORMATS) {
    const url = canvas.toDataURL(type, quality);
    if (url.startsWith(`data:${type}`)) return url;
  }
  const fallback = canvas.toDataURL("image/webp", quality);
  return fallback.startsWith("data:image/webp") ? fallback : "";
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new ImageUploadError("decode_failed", "Image could not be decoded"));
    image.src = url;
  });
}

async function decodeViaObjectUrl(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(url);
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof ImageUploadError
      ? error
      : new ImageUploadError("decode_failed", "Image could not be decoded", { cause: error });
  }
}

async function decodeHeic(file: File): Promise<DecodedImage> {
  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/png" });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error("HEIC decoder returned no image");
    return await decodeViaObjectUrl(blob);
  } catch (error) {
    throw new ImageUploadError("heic_failed", "HEIC image could not be decoded", {
      cause: error,
    });
  }
}

async function decodeImageFile(file: File): Promise<DecodedImage> {
  if (isHeicImageFile(file)) return decodeHeic(file);

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the object-URL decoder for engines without File bitmap support.
    }
  }

  return decodeViaObjectUrl(file);
}

async function encodeWithinBudget(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
  formats: readonly string[],
): Promise<{ blob: Blob; type: string } | null> {
  const dimensionScales = [1, 0.85, 0.7];
  const qualitySteps = [quality, Math.max(0.45, quality * 0.8), 0.5];

  for (const scale of dimensionScales) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const nextQuality of qualitySteps) {
      const encoded = await canvasToOptimizedBlob(canvas, nextQuality, formats);
      if (encoded && encoded.blob.size <= IMAGE_UPLOAD_MAX_OUTPUT_BYTES) return encoded;
    }
  }
  return null;
}

/**
 * Resizes and compresses an image file on the client side, preferring AVIF and
 * falling back to WebP. Throws `ImageUploadError` instead of uploading the
 * unencoded original (which the AVIF/WebP-only endpoint would reject).
 */
export async function optimizeImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    formats?: readonly string[];
  } = {},
): Promise<File> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.82,
    formats = IMAGE_ENCODE_FORMATS,
  } = options;

  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!isSupportedImageSource(file)) {
    throw new ImageUploadError("unsupported_format", "Unsupported image format");
  }
  if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
    throw new ImageUploadError("too_large", "Image source is too large");
  }

  const decoded = await decodeImageFile(file);
  try {
    let width = decoded.width;
    let height = decoded.height;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const encoded = await encodeWithinBudget(decoded.source, width, height, quality, formats);
    if (!encoded) {
      throw new ImageUploadError("encode_failed", "Image could not be encoded");
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";
    return new File([encoded.blob], `${baseName}${imageExtensionForMime(encoded.type)}`, {
      type: encoded.type,
      lastModified: Date.now(),
    });
  } finally {
    decoded.cleanup();
  }
}

/** Encodes a user-selected image using the requested upload preset. */
export function prepareImageForUpload(
  file: File,
  purpose: ImageUploadPurpose = "general",
): Promise<File> {
  return optimizeImage(file, IMAGE_UPLOAD_PRESETS[purpose]);
}
