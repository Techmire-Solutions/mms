import {
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
  IMAGE_UPLOAD_PRESETS,
  imageExtensionForMime,
  type ImageUploadPurpose,
  type ImageUploadResponse,
} from '@mms/shared';
import { canvasToOptimizedBlob, prepareImageForUpload } from '@/lib/imageOptimization';
import { apiJson, resolveApiUrl } from '@/lib/apiClient';

function assertImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
    throw new Error('image_too_large');
  }
}

/** Uploads an already-encoded AVIF/WebP file to the MMS image API. */
export async function uploadImageFile(
  file: File,
  purpose: ImageUploadPurpose = 'general',
): Promise<string> {
  const form = new FormData();
  form.append('image', file, file.name);

  const { url } = await apiJson<ImageUploadResponse>(
    `/api/uploads/image?purpose=${encodeURIComponent(purpose)}`,
    {
      method: 'POST',
      body: form,
    },
  );

  return resolveApiUrl(url);
}

/**
 * Global client entry: AVIF-first encode, then server upload.
 * Every picture picker in the app must use this helper.
 */
export async function uploadUserImage(
  file: File,
  purpose: ImageUploadPurpose = 'general',
): Promise<string> {
  assertImageFile(file);
  const optimized = await prepareImageForUpload(file, purpose);
  return uploadImageFile(optimized, purpose);
}

/** Encodes a canvas (e.g. avatar crop) to AVIF/WebP and uploads it. */
export async function uploadCanvasImage(
  canvas: HTMLCanvasElement,
  purpose: ImageUploadPurpose = 'avatar',
): Promise<string> {
  const preset = IMAGE_UPLOAD_PRESETS[purpose];
  const encoded = await canvasToOptimizedBlob(canvas, preset.quality, preset.formats);
  if (!encoded) {
    throw new Error('image_encode_failed');
  }

  const ext = imageExtensionForMime(encoded.type);
  const file = new File([encoded.blob], `image${ext}`, {
    type: encoded.type,
    lastModified: Date.now(),
  });

  return uploadImageFile(file, purpose);
}
