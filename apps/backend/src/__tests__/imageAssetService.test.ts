import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveUploadedImage, sniffImageFormat } from "../services/imageAssetService.js";
import { Readable } from "node:stream";

// Minimal valid container headers (magic bytes only).
const AVIF_BYTES = Buffer.from("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1", "latin1");
const WEBP_BYTES = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1");

describe("saveUploadedImage", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mms-upload-"));
    vi.stubEnv("MMS_UPLOADS_DIR", tempDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("persists AVIF logos under /uploads/branding", async () => {
    const buffer = AVIF_BYTES;
    const url = await saveUploadedImage(buffer, "image/avif", "logo");

    expect(url).toMatch(/^\/uploads\/branding\/[0-9a-f-]+\.avif$/);

    const filename = url.split("/").pop()!;
    const saved = await readFile(join(tempDir, "branding", filename));
    expect(saved.equals(buffer)).toBe(true);
  });

  it("persists AVIF avatars under /uploads/avatars", async () => {
    const buffer = AVIF_BYTES;
    const url = await saveUploadedImage(buffer, "image/avif", "avatar");

    expect(url).toMatch(/^\/uploads\/avatars\/[0-9a-f-]+\.avif$/);
  });

  it("persists WebP images under /uploads/images", async () => {
    const url = await saveUploadedImage(WEBP_BYTES, "image/webp", "general");
    expect(url).toMatch(/^\/uploads\/images\/[0-9a-f-]+\.webp$/);
  });

  it("rejects non-AVIF/WebP uploads", async () => {
    await expect(saveUploadedImage(Buffer.from("x"), "image/png", "general")).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    );
  });

  it("rejects content that does not match the declared mimetype", async () => {
    // Declared AVIF but actually WebP content.
    await expect(saveUploadedImage(WEBP_BYTES, "image/avif", "general")).rejects.toMatchObject({
      statusCode: 400,
    });
    // Declared WebP but arbitrary (non-image) content.
    await expect(
      saveUploadedImage(Buffer.from("fake-webp-bytes"), "image/webp", "general"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("sniffs AVIF and WebP magic bytes", () => {
    expect(sniffImageFormat(AVIF_BYTES)).toBe("avif");
    expect(sniffImageFormat(WEBP_BYTES)).toBe("webp");
    expect(sniffImageFormat(Buffer.from("not an image"))).toBeNull();
  });

  it("persists streaming image uploads without buffering", async () => {
    const stream = Readable.from([AVIF_BYTES]);
    const url = await saveUploadedImage(stream, "image/avif", "logo");
    expect(url).toMatch(/^\/uploads\/branding\/[0-9a-f-]+\.avif$/);
  });

  it("partitions image uploads by tenant when tenant is provided", async () => {
    const url = await saveUploadedImage(AVIF_BYTES, "image/avif", "avatar", "demo");
    expect(url).toMatch(/^\/uploads\/tenants\/demo\/avatars\/[0-9a-f-]+\.avif$/);

    const filename = url.split("/").pop()!;
    const saved = await readFile(join(tempDir, "tenants", "demo", "avatars", filename));
    expect(saved.equals(AVIF_BYTES)).toBe(true);
  });
});
