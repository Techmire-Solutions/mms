import type { AppTranslationKey } from "@mms/shared";

export type ImageUploadErrorCode =
  | "unsupported_format"
  | "decode_failed"
  | "heic_failed"
  | "encode_failed"
  | "too_large"
  | "server_rejected";

/** Typed client-side image failure so callers can show an actionable message. */
export class ImageUploadError extends Error {
  readonly code: ImageUploadErrorCode;

  constructor(code: ImageUploadErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
    if (options && "cause" in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  static fromApi(error: unknown, fallback: ImageUploadErrorCode = "server_rejected") {
    const message = error instanceof Error && error.message ? error.message : "Image upload failed";
    return new ImageUploadError(fallback, message, { cause: error });
  }
}

export function isImageUploadError(error: unknown): error is ImageUploadError {
  return error instanceof ImageUploadError;
}

const ERROR_KEYS: Record<ImageUploadErrorCode, AppTranslationKey> = {
  unsupported_format: "image.upload.unsupportedFormat",
  decode_failed: "image.upload.decodeFailed",
  heic_failed: "image.upload.heicFailed",
  encode_failed: "image.upload.encodeFailed",
  too_large: "image.upload.tooLarge",
  server_rejected: "image.upload.serverRejected",
};

/** Translation key for a failed upload; unknown failures keep the legacy message. */
export function imageUploadErrorKey(error: unknown): AppTranslationKey {
  if (isImageUploadError(error)) return ERROR_KEYS[error.code];
  return "account.photoUploadFailed";
}

/** Optional server-provided detail to show under the localized headline. */
export function imageUploadErrorDetail(error: unknown): string | undefined {
  if (isImageUploadError(error) && error.code === "server_rejected" && error.message) {
    return error.message;
  }
  return undefined;
}
