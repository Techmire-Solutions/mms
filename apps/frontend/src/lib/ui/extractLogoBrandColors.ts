import {
  deriveBrandColorsFromPalette,
  extractDominantWeightedSwatchesFromRgba,
  type LogoBrandColors,
  type LogoPaletteSamplingOptions,
} from "@mms/shared";
import { apiFetch, resolveApiUrl } from "@/lib/apiClient";

export type ExtractLogoBrandColorsOptions = LogoPaletteSamplingOptions & {
  /** Longest canvas edge when downsampling before pixel read (performance vs accuracy). */
  sampleSize?: number;
  /** Optional signal to cancel the image fetch/loading process. */
  signal?: AbortSignal;
};

const DEFAULT_OPTIONS: Required<Pick<ExtractLogoBrandColorsOptions, "sampleSize">> &
  LogoPaletteSamplingOptions = {
  sampleSize: 96,
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

function isInlineImageSource(src: string): boolean {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function normalizeImageSource(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || isInlineImageSource(trimmed)) {
    return trimmed;
  }
  return resolveApiUrl(trimmed);
}

function inferImageMimeFromUrl(url: string): string | null {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return null;
}

function normalizeFetchedImageBlob(blob: Blob, url: string): Blob {
  if (blob.type.startsWith("image/")) return blob;
  const inferred = inferImageMimeFromUrl(url);
  if (!inferred) {
    throw new Error("Invalid image payload");
  }
  return new Blob([blob], { type: inferred });
}

/** Fetches server-stored AVIF/WebP logos as a blob URL so canvas sampling is not tainted in dev. */
async function resolveImageLoadSource(
  src: string,
  signal?: AbortSignal,
): Promise<{ src: string; revoke?: () => void }> {
  const normalized = normalizeImageSource(src);
  if (!normalized) {
    throw new Error("empty_image_source");
  }

  if (isInlineImageSource(normalized)) {
    return { src: normalized };
  }

  const response = await apiFetch(normalized, { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch image for colour extraction");
  }

  const blob = normalizeFetchedImageBlob(await response.blob(), normalized);
  const objectUrl = URL.createObjectURL(blob);
  return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
}

function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException("Aborted", "AbortError"));
    }
    const image = new Image();
    image.decoding = "async";

    const onAbort = () => {
      image.src = "";
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }

    image.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(image);
    };
    image.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new Error("Failed to load image for colour extraction"));
    };
    image.src = src;
  });
}

/**
 * Reads a logo image and returns primary/accent brand colours.
 *
 * Pipeline:
 * 1. Load image (data URL, blob URL, or `/uploads/…` AVIF/WebP path)
 * 2. Downsample onto a canvas for fast pixel reads
 * 3. {@link extractDominantSwatchesFromRgba} — weighted palette extraction
 * 4. {@link deriveBrandColorsFromPalette} — pick UI primary/accent + WCAG contrast
 */
export async function extractLogoBrandColors(
  imageSource: string,
  options?: ExtractLogoBrandColorsOptions,
): Promise<LogoBrandColors | null> {
  if (!imageSource.trim()) return null;

  const { sampleSize, signal, ...samplingOptions } = { ...DEFAULT_OPTIONS, ...options };
  let revokeObjectUrl: (() => void) | undefined;

  try {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const loadSource = await resolveImageLoadSource(imageSource, signal);
    revokeObjectUrl = loadSource.revoke;

    const image = await loadImage(loadSource.src, signal);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1);
    const scale = sampleSize / longestEdge;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    const weightedSwatches = extractDominantWeightedSwatchesFromRgba(
      data,
      width,
      height,
      samplingOptions,
    );
    const swatches = weightedSwatches.map((s) => s.hex);
    const proportions = weightedSwatches.map((s) => ({ hex: s.hex, percentage: s.percentage }));

    return deriveBrandColorsFromPalette(swatches, { proportions });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      throw error;
    }
    return null;
  } finally {
    revokeObjectUrl?.();
  }
}
