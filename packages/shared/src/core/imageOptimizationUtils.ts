/**
 * Preferred client-side encode formats, best-first.
 * AVIF gives the smallest files; WebP is the broad-support fallback.
 */
export const IMAGE_ENCODE_FORMATS = ["image/avif", "image/webp"] as const;

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/avif": ".avif",
  "image/webp": ".webp",
};

/** Max raw picker file size before client-side AVIF encode (bytes). */
export const IMAGE_UPLOAD_MAX_INPUT_BYTES = 2 * 1024 * 1024;

/** Resize/encode presets — AVIF first, WebP fallback; used by every image uploader. */
export const IMAGE_UPLOAD_PRESETS = {
  avatar: { maxWidth: 300, maxHeight: 300, quality: 0.78, formats: IMAGE_ENCODE_FORMATS },
  logo: { maxWidth: 200, maxHeight: 200, quality: 0.82, formats: IMAGE_ENCODE_FORMATS },
  favicon: { maxWidth: 64, maxHeight: 64, quality: 0.82, formats: IMAGE_ENCODE_FORMATS },
  general: { maxWidth: 800, maxHeight: 800, quality: 0.82, formats: IMAGE_ENCODE_FORMATS },
} as const;

/** Supported image-upload optimization preset names. */
export type ImageUploadPurpose = keyof typeof IMAGE_UPLOAD_PRESETS;

/** Returns the canonical filename extension for an encoded image MIME type. */
export function imageExtensionForMime(mimeType: string): string {
  return IMAGE_EXT_BY_TYPE[mimeType] ?? ".webp";
}
