import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  IMAGE_UPLOAD_MAX_BYTES,
  assertAllowedImageMime,
  categoryForUploadPurpose,
  ensureUploadCategoryDir,
  imageExtensionForMime,
  type ImageUploadPurpose,
} from "../config/uploadConfig.js";

/**
 * Sniffs the actual image container from magic bytes so a client cannot store
 * arbitrary content (e.g. HTML/JS) under an image extension by lying about the
 * mimetype. Returns 'avif' | 'webp' | null.
 */
export function sniffImageFormat(buffer: Buffer): "avif" | "webp" | null {
  if (buffer.length < 12) return null;
  const ascii = (start: number, end: number) => buffer.toString("latin1", start, end);
  // WebP: "RIFF" .... "WEBP"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // AVIF: ISO-BMFF "ftyp" box with major brand avif/avis
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

/**
 * Persists a client-encoded AVIF/WebP image (from Buffer or stream) and returns its public URL path.
 */
export async function saveUploadedImage(
  source: Buffer | NodeJS.ReadableStream,
  mimeType: string,
  purpose: ImageUploadPurpose,
  tenant?: string | null,
): Promise<string> {
  assertAllowedImageMime(mimeType);

  const category = categoryForUploadPurpose(purpose);
  const cleanTenant = tenant?.trim().toLowerCase() || undefined;
  const dir = await ensureUploadCategoryDir(category, cleanTenant);
  const ext = imageExtensionForMime(mimeType);
  const filename = `${randomUUID()}${ext}`;
  const filepath = join(dir, filename);
  const expected = mimeType === "image/avif" ? "avif" : "webp";

  const publicUrl = cleanTenant
    ? `/uploads/tenants/${cleanTenant}/${category}/${filename}`
    : `/uploads/${category}/${filename}`;

  if (Buffer.isBuffer(source)) {
    if (source.length === 0) {
      throw Object.assign(new Error("Image file is empty"), {
        statusCode: 400,
        type: "validation_error",
      });
    }

    if (source.length > IMAGE_UPLOAD_MAX_BYTES) {
      throw Object.assign(new Error("Image file is too large"), {
        statusCode: 400,
        type: "validation_error",
      });
    }

    const sniffed = sniffImageFormat(source);
    if (sniffed !== expected) {
      throw Object.assign(new Error("Image content does not match the declared format"), {
        statusCode: 400,
        type: "validation_error",
      });
    }

    await writeFile(filepath, source);
    return publicUrl;
  }

  // Stream pipeline: sniff magic bytes from first chunk and limit bytes without loading file into process memory
  let bytesWritten = 0;
  let headerBuffer = Buffer.alloc(0);
  let verified = false;

  const limiterAndSniffer = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesWritten += chunk.length;
      if (bytesWritten > IMAGE_UPLOAD_MAX_BYTES) {
        callback(
          Object.assign(new Error("Image file is too large"), {
            statusCode: 400,
            type: "validation_error",
          }),
        );
        return;
      }

      if (!verified) {
        headerBuffer = Buffer.concat([headerBuffer, chunk]);
        if (headerBuffer.length >= 12) {
          const sniffed = sniffImageFormat(headerBuffer);
          if (sniffed !== expected) {
            callback(
              Object.assign(new Error("Image content does not match the declared format"), {
                statusCode: 400,
                type: "validation_error",
              }),
            );
            return;
          }
          verified = true;
        }
      }
      callback(null, chunk);
    },
    flush(callback) {
      if (bytesWritten === 0) {
        callback(
          Object.assign(new Error("Image file is empty"), {
            statusCode: 400,
            type: "validation_error",
          }),
        );
        return;
      }
      if (!verified) {
        const sniffed = sniffImageFormat(headerBuffer);
        if (sniffed !== expected) {
          callback(
            Object.assign(new Error("Image content does not match the declared format"), {
              statusCode: 400,
              type: "validation_error",
            }),
          );
          return;
        }
      }
      callback();
    },
  });

  try {
    await pipeline(source, limiterAndSniffer, createWriteStream(filepath));
    return publicUrl;
  } catch (err) {
    await unlink(filepath).catch(() => {});
    throw err;
  }
}
