import {
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
  IMAGE_UPLOAD_MAX_OUTPUT_BYTES,
  IMAGE_UPLOAD_PRESETS,
  imageExtensionForMime,
  type ImageUploadPurpose,
  type ImageUploadResponse,
} from "@mms/shared";
import {
  blobHasImageSignature,
  canvasToOptimizedBlob,
  isSupportedImageSource,
  prepareImageForUpload,
} from "@/lib/imageOptimization";
import { ImageUploadError } from "@/lib/imageUploadErrors";
import { apiJson, resolveApiUrl } from "@/lib/apiClient";

const ACCEPTED_IMAGE_TYPES = new Set(["image/avif", "image/webp"]);

function assertUploadableImage(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new ImageUploadError(
      "unsupported_format",
      `Unsupported upload type ${file.type || "(unknown)"}`,
    );
  }
}

function assertImageFile(file: File): void {
  if (!isSupportedImageSource(file)) {
    throw new ImageUploadError("unsupported_format", "Unsupported image format");
  }
  if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
    throw new ImageUploadError("too_large", "Image is larger than the upload limit");
  }
}

/** Uploads an already-encoded AVIF/WebP file to the MMS image API. */
export async function uploadImageFile(
  file: File,
  purpose: ImageUploadPurpose = "general",
): Promise<string> {
  assertUploadableImage(file);
  if (!(await blobHasImageSignature(file, file.type))) {
    throw new ImageUploadError("encode_failed", "Image content does not match its format");
  }

  const form = new FormData();
  form.append("image", file, file.name);

  try {
    const { url } = await apiJson<ImageUploadResponse>(
      `/api/uploads/image?purpose=${encodeURIComponent(purpose)}`,
      {
        method: "POST",
        body: form,
      },
    );
    return resolveApiUrl(url);
  } catch (error) {
    throw ImageUploadError.fromApi(error, "server_rejected");
  }
}

/**
 * Global client entry: AVIF-first encode, then server upload.
 * Every picture picker in the app must use this helper.
 */
export async function uploadUserImage(
  file: File,
  purpose: ImageUploadPurpose = "general",
): Promise<string> {
  assertImageFile(file);
  const optimized = await prepareImageForUpload(file, purpose);
  return uploadImageFile(optimized, purpose);
}

/** Encodes a canvas (e.g. avatar crop) to AVIF/WebP and uploads it. */
export async function uploadCanvasImage(
  canvas: HTMLCanvasElement,
  purpose: ImageUploadPurpose = "avatar",
): Promise<string> {
  const preset = IMAGE_UPLOAD_PRESETS[purpose];
  const encoded = await canvasToOptimizedBlob(canvas, preset.quality, preset.formats);
  if (!encoded) {
    throw new ImageUploadError("encode_failed", "Image could not be encoded");
  }
  if (encoded.blob.size > IMAGE_UPLOAD_MAX_OUTPUT_BYTES) {
    throw new ImageUploadError("too_large", "Encoded image is larger than the upload limit");
  }

  const ext = imageExtensionForMime(encoded.type);
  const file = new File([encoded.blob], `image${ext}`, {
    type: encoded.type,
    lastModified: Date.now(),
  });

  return uploadImageFile(file, purpose);
}
