import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, normalize, relative, dirname } from "node:path";
import { resolveUploadsRoot } from "../config/uploadConfig.js";
import type { TenantDatabaseSnapshot } from "@mms/shared";
import { logger } from "../lib/logger.js";

const UPLOADS_PATH_REGEX = /^\/uploads\/([a-zA-Z0-9_\-/.]+)$/;

/**
 * Recursively scans all collections and objects in a snapshot for `/uploads/...` URLs.
 */
export function collectReferencedAssetUrls(snapshot: TenantDatabaseSnapshot): Set<string> {
  const urls = new Set<string>();
  if (snapshot.collections) {
    for (const key in snapshot.collections) {
      if (Object.prototype.hasOwnProperty.call(snapshot.collections, key)) {
        collectAssetUrlsFromValue(snapshot.collections[key], urls);
      }
    }
  }
  if (snapshot.objects) {
    for (const key in snapshot.objects) {
      if (Object.prototype.hasOwnProperty.call(snapshot.objects, key)) {
        collectAssetUrlsFromValue(snapshot.objects[key], urls);
      }
    }
  }
  return urls;
}

/**
 * Recursively scans a single value (a collection's rows, an object, a row) for
 * `/uploads/...` URLs, adding them to `urls`. Used by the streaming backup path
 * to collect asset references as each collection/object is streamed.
 */
export function collectAssetUrlsFromValue(value: unknown, urls: Set<string>): void {
  if (!value) return;
  if (typeof value === "string") {
    if (value.length >= 10 && value.includes("/uploads/")) {
      const trimmed = value.trim();
      if (UPLOADS_PATH_REGEX.test(trimmed)) {
        urls.add(trimmed);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectAssetUrlsFromValue(value[i], urls);
    }
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        collectAssetUrlsFromValue(obj[key], urls);
      }
    }
  }
}

/**
 * Safely resolves a disk path for an `/uploads/...` URL, verifying no directory traversal.
 */
export function resolveSafeUploadDiskPath(urlPath: string): string | null {
  const match = UPLOADS_PATH_REGEX.exec(urlPath.trim());
  if (!match || !match[1]) return null;

  const relativePath = match[1];
  const root = resolveUploadsRoot();
  const target = normalize(join(root, relativePath));

  const rel = relative(root, target);
  if (rel.startsWith("..") || rel.startsWith("/") || rel.includes("..")) {
    return null; // Path traversal attempt
  }

  return target;
}

const MAX_BACKUP_ASSET_FILE_BYTES = 25 * 1024 * 1024; // 25MB per asset
/** Combined cap across all referenced assets so a backup snapshot cannot grow without bound. */
const MAX_BACKUP_TOTAL_ASSET_BYTES = 200 * 1024 * 1024; // 200MB total

/**
 * Reads a single referenced upload asset from disk and returns its base64, or
 * `null` when the file is missing/oversized. Used by the streaming backup path to
 * emit assets one at a time (bounded peak memory to one file) instead of buffering
 * every asset in the snapshot.
 */
export async function readAssetBase64(url: string): Promise<string | null> {
  const diskPath = resolveSafeUploadDiskPath(url);
  if (!diskPath) return null;
  try {
    const fileStat = await stat(diskPath);
    if (!fileStat.isFile()) return null;
    if (fileStat.size > MAX_BACKUP_ASSET_FILE_BYTES) {
      logger.warn({ url, size: fileStat.size }, "Skipping asset exceeding 25MB limit");
      return null;
    }
    const buffer = await readFile(diskPath);
    return buffer.toString("base64");
  } catch {
    return null;
  }
}

/**
 * Exports referenced upload assets (logos, avatars, attachments, pictures) as base64 strings.
 */
export async function exportBackupAssetsForSnapshot(
  snapshot: TenantDatabaseSnapshot,
): Promise<Record<string, string>> {
  const urls = collectReferencedAssetUrls(snapshot);
  const assets: Record<string, string> = {};
  let totalBytes = 0;

  for (const url of urls) {
    const diskPath = resolveSafeUploadDiskPath(url);
    if (!diskPath) continue;

    try {
      const fileStat = await stat(diskPath);
      if (!fileStat.isFile()) continue;
      if (fileStat.size > MAX_BACKUP_ASSET_FILE_BYTES) {
        logger.warn({ url, size: fileStat.size }, "Skipping asset exceeding 25MB limit");
        continue;
      }
      totalBytes += fileStat.size;
      if (totalBytes > MAX_BACKUP_TOTAL_ASSET_BYTES) {
        throw new Error(
          `Backup asset set exceeds maximum of ${MAX_BACKUP_TOTAL_ASSET_BYTES} bytes combined`,
        );
      }

      const base64 = await readAssetBase64(url);
      if (base64 != null) assets[url] = base64;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Backup asset set exceeds")) {
        throw error;
      }
      // Missing file on disk — skip gracefully so backup export doesn't fail
    }
  }

  return assets;
}

/**
 * Restores binary image and attachment files from a backup payload to the uploads directory.
 */
export async function restoreTenantAssets(assets: Record<string, string>): Promise<void> {
  if (!assets || typeof assets !== "object") return;

  for (const [urlPath, base64Data] of Object.entries(assets)) {
    if (typeof urlPath !== "string" || typeof base64Data !== "string") continue;

    const diskPath = resolveSafeUploadDiskPath(urlPath);
    if (!diskPath) continue;

    try {
      const commaIdx = base64Data.indexOf(",");
      const cleanBase64 = commaIdx >= 0 ? base64Data.slice(commaIdx + 1) : base64Data;
      if (!cleanBase64) continue;

      const buffer = Buffer.from(cleanBase64, "base64");
      if (buffer.length === 0) continue;

      await mkdir(dirname(diskPath), { recursive: true });
      await writeFile(diskPath, buffer);
    } catch (err) {
      logger.error(
        { urlPath, err: err instanceof Error ? err.message : "error" },
        "Failed to restore asset",
      );
    }
  }
}
