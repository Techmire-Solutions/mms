import {
  IMAGE_ENCODE_FORMATS,
  IMAGE_UPLOAD_PRESETS,
  imageExtensionForMime,
  type ImageUploadPurpose,
} from "@mms/shared";

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Encodes a canvas to the best-available modern format (AVIF → WebP), returning
 * the encoded blob and its actual MIME type.
 */
export async function canvasToOptimizedBlob(
  canvas: HTMLCanvasElement,
  quality = 0.82,
  formats: readonly string[] = IMAGE_ENCODE_FORMATS,
): Promise<{ blob: Blob; type: string } | null> {
  for (const type of formats) {
    const blob = await canvasToBlobAsync(canvas, type, quality);
    if (blob && blob.type === type) return { blob, type };
  }
  const fallback = await canvasToBlobAsync(canvas, "image/webp", quality);
  if (fallback) return { blob: fallback, type: fallback.type || "image/webp" };
  return null;
}

/**
 * Encodes a canvas to an optimized data URL (AVIF → WebP).
 */
export function canvasToOptimizedDataUrl(canvas: HTMLCanvasElement, quality = 0.82): string {
  for (const type of IMAGE_ENCODE_FORMATS) {
    const url = canvas.toDataURL(type, quality);
    if (url.startsWith(`data:${type}`)) return url;
  }
  return canvas.toDataURL("image/webp", quality);
}

/**
 * Resizes and compresses an image file on the client side, preferring AVIF and
 * falling back to WebP (then the original file).
 */
export function optimizeImage(
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

  if (
    typeof window === "undefined" ||
    typeof FileReader === "undefined" ||
    !file.type.startsWith("image/")
  ) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const image = new Image();
      image.onload = async () => {
        let width = image.width;
        let height = image.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          resolve(file);
          return;
        }

        canvasContext.drawImage(image, 0, 0, width, height);

        const encoded = await canvasToOptimizedBlob(canvas, quality, formats);
        if (!encoded) {
          resolve(file);
          return;
        }

        const extension = imageExtensionForMime(encoded.type);
        const optimizedFile = new File(
          [encoded.blob],
          file.name.replace(/\.[^/.]+$/, "") + extension,
          {
            type: encoded.type,
            lastModified: Date.now(),
          },
        );
        resolve(optimizedFile);
      };
      image.onerror = () => resolve(file);
      image.src = loadEvent.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Encodes a user-selected image using the requested upload preset.
 */
export function prepareImageForUpload(
  file: File,
  purpose: ImageUploadPurpose = "general",
): Promise<File> {
  return optimizeImage(file, IMAGE_UPLOAD_PRESETS[purpose]);
}
