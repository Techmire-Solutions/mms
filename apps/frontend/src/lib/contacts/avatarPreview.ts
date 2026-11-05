import { IMAGE_UPLOAD_MAX_INPUT_BYTES } from "@mms/shared";
import { isSupportedImageSource } from "@/lib/imageOptimization";
import { ImageUploadError } from "@/lib/imageUploadErrors";

export interface PreparedAvatarPreview {
  /** Object URL for the cropper preview; revoke via cleanup when replaced. */
  url: string;
  cleanup: () => void;
}

/**
 * Normalises a picked avatar file into a browser-displayable object URL.
 * Validation happens before creating the URL so the caller gets a typed, localized error.
 */
export async function prepareAvatarPreview(file: File): Promise<PreparedAvatarPreview> {
  if (!isSupportedImageSource(file)) {
    throw new ImageUploadError("unsupported_format", "Unsupported image format");
  }
  if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
    throw new ImageUploadError("too_large", "Avatar source is too large");
  }

  const url = URL.createObjectURL(file);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}
