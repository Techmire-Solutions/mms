import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveBackendRoot } from "./loadEnv.js";

/** Max optimized image payload accepted by the upload API (bytes). */
export const IMAGE_UPLOAD_MAX_BYTES = 512 * 1024;

export const IMAGE_UPLOAD_PURPOSES = ["avatar", "logo", "favicon", "general"] as const;
export type ImageUploadPurpose = (typeof IMAGE_UPLOAD_PURPOSES)[number];

export type ImageUploadCategory = "avatars" | "branding" | "images";

const PURPOSE_TO_CATEGORY: Record<ImageUploadPurpose, ImageUploadCategory> = {
  avatar: "avatars",
  logo: "branding",
  favicon: "branding",
  general: "images",
};

const ALLOWED_IMAGE_MIME = new Set(["image/avif", "image/webp"]);

const IMAGE_EXT: Record<string, string> = {
  "image/avif": ".avif",
  "image/webp": ".webp",
};

export function resolveUploadsRoot(): string {
  const configured = process.env.MMS_UPLOADS_DIR?.trim();
  if (configured) return configured;
  return join(resolveBackendRoot(), "uploads");
}

/** Creates the uploads root (and parents) before static file serving. */
export async function ensureUploadsRoot(): Promise<string> {
  const root = resolveUploadsRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export function resolveUploadCategoryDir(
  category: ImageUploadCategory,
  tenant?: string | null,
): string {
  if (tenant && tenant.trim()) {
    return join(resolveUploadsRoot(), "tenants", tenant.trim().toLowerCase(), category);
  }
  return join(resolveUploadsRoot(), category);
}

export async function ensureUploadCategoryDir(
  category: ImageUploadCategory,
  tenant?: string | null,
): Promise<string> {
  const dir = resolveUploadCategoryDir(category, tenant);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function categoryForUploadPurpose(purpose: ImageUploadPurpose): ImageUploadCategory {
  return PURPOSE_TO_CATEGORY[purpose];
}

export function normalizeImageMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export function assertAllowedImageMime(mimeType: string): string {
  const normalized = normalizeImageMimeType(mimeType);
  if (!ALLOWED_IMAGE_MIME.has(normalized)) {
    throw Object.assign(new Error("Image must be AVIF or WebP"), {
      statusCode: 400,
      type: "validation_error",
    });
  }
  return normalized;
}

export function imageExtensionForMime(mimeType: string): string {
  const normalized = assertAllowedImageMime(mimeType);
  return IMAGE_EXT[normalized] ?? ".webp";
}

export function parseImageUploadPurpose(value: string | undefined): ImageUploadPurpose {
  const normalized = value?.trim().toLowerCase();
  if (normalized && (IMAGE_UPLOAD_PURPOSES as readonly string[]).includes(normalized)) {
    return normalized as ImageUploadPurpose;
  }
  return "general";
}
