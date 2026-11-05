import { IMAGE_UPLOAD_MAX_INPUT_BYTES } from "@mms/shared";
import { isHeicImageFile, isSupportedImageSource } from "@/lib/imageOptimization";
import { ImageUploadError } from "@/lib/imageUploadErrors";

export interface PreparedAvatarPreview {
  /** Object URL for the cropper preview; revoke via cleanup when replaced. */
  url: string;
  cleanup: () => void;
}

/**
 * Normalises a picked avatar file into a browser-displayable object URL.
 *
 * HEIC is decoded through the lazy libheif wasm encoder because Chrome/Firefox
 * cannot render it; other formats avoid the extra decode. Validation happens
 * before any decode so the caller gets a typed, localized error.
 */
export async function prepareAvatarPreview(file: File): Promise<PreparedAvatarPreview> {
  if (!isSupportedImageSource(file)) {
    throw new ImageUploadError("unsupported_format", "Unsupported image format");
  }
  if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
    throw new ImageUploadError("too_large", "Avatar source is too large");
  }

  let source: Blob = file;
  if (isHeicImageFile(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/png" });
      source = Array.isArray(converted) ? converted[0] : converted;
    } catch (error) {
      throw new ImageUploadError("heic_failed", "HEIC image could not be decoded", {
        cause: error,
      });
    }
  }

  const url = URL.createObjectURL(source);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}
