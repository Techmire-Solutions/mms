import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  collectReferencedAssetUrls,
  resolveSafeUploadDiskPath,
  exportBackupAssetsForSnapshot,
  restoreTenantAssets,
} from "../services/backupAssetService.js";
import type { TenantDatabaseSnapshot } from "@mms/shared";
import * as fsPromises from "node:fs/promises";
import { join } from "node:path";

vi.mock("../config/uploadConfig.js", () => ({
  resolveUploadsRoot: vi.fn(() => "/mock/uploads"),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof fsPromises>("node:fs/promises");
  return {
    ...actual,
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
});

describe("backupAssetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("collectReferencedAssetUrls", () => {
    it("finds upload URLs across collections and objects", () => {
      const snapshot: TenantDatabaseSnapshot = {
        collections: {
          contacts: [
            { id: "c1", name: "Zaid", photoUrl: "/uploads/avatars/zaid.webp" },
            { id: "c2", attachments: [{ url: "/uploads/attachments/id.pdf" }] },
          ],
          students: [{ id: "s1", avatarUrl: "/uploads/avatars/student.webp" }],
        },
        objects: {
          branding: {
            logoUrl: "/uploads/branding/logo.webp",
            faviconUrl: "/uploads/branding/favicon.webp",
            stampUrl: "/uploads/branding/stamp.avif",
            primaryColor: "#0055ff",
          },
        },
      };

      const urls = collectReferencedAssetUrls(snapshot);
      expect(Array.from(urls).sort()).toEqual([
        "/uploads/attachments/id.pdf",
        "/uploads/avatars/student.webp",
        "/uploads/avatars/zaid.webp",
        "/uploads/branding/favicon.webp",
        "/uploads/branding/logo.webp",
        "/uploads/branding/stamp.avif",
      ]);
    });

    it("ignores non-upload URLs and empty snapshots", () => {
      const snapshot: TenantDatabaseSnapshot = {
        collections: {
          contacts: [{ id: "c1", website: "https://example.com/pic.jpg" }],
        },
        objects: {
          settings: { color: "blue" },
        },
      };

      const urls = collectReferencedAssetUrls(snapshot);
      expect(urls.size).toBe(0);
    });
  });

  describe("resolveSafeUploadDiskPath", () => {
    it("resolves valid upload sub-paths under uploads root", () => {
      const resolved = resolveSafeUploadDiskPath("/uploads/branding/logo.webp");
      expect(resolved).toBe(join("/mock/uploads", "branding", "logo.webp"));
    });

    it("blocks directory traversal attempts", () => {
      expect(resolveSafeUploadDiskPath("/uploads/../secret.txt")).toBeNull();
      expect(resolveSafeUploadDiskPath("/uploads/../../etc/passwd")).toBeNull();
      expect(resolveSafeUploadDiskPath("/uploads/branding/../../config.json")).toBeNull();
    });

    it("rejects invalid path shapes", () => {
      expect(resolveSafeUploadDiskPath("http://localhost/uploads/logo.webp")).toBeNull();
      expect(resolveSafeUploadDiskPath("/other/path/file.webp")).toBeNull();
    });
  });

  describe("exportBackupAssetsForSnapshot", () => {
    it("reads files from disk and encodes them as base64", async () => {
      const snapshot: TenantDatabaseSnapshot = {
        objects: {
          branding: { logoUrl: "/uploads/branding/logo.webp" },
        },
      };

      vi.mocked(fsPromises.stat).mockResolvedValue({ isFile: () => true } as any);
      vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from("fake-image-bytes"));

      const assets = await exportBackupAssetsForSnapshot(snapshot);
      expect(assets).toHaveProperty("/uploads/branding/logo.webp");
      expect(assets["/uploads/branding/logo.webp"]).toBe(
        Buffer.from("fake-image-bytes").toString("base64"),
      );
    });

    it("gracefully skips missing files on disk without throwing", async () => {
      const snapshot: TenantDatabaseSnapshot = {
        objects: {
          branding: { logoUrl: "/uploads/branding/missing.webp" },
        },
      };

      vi.mocked(fsPromises.stat).mockRejectedValue(new Error("ENOENT"));

      const assets = await exportBackupAssetsForSnapshot(snapshot);
      expect(Object.keys(assets)).toHaveLength(0);
    });

    it("throws when the combined referenced assets exceed the total cap", async () => {
      // 12 files at 24MB each -> 288MB combined: all under the 25MB per-file cap
      // but over the 200MB combined cap.
      const urls: Record<string, string> = {};
      for (let i = 0; i < 12; i++) {
        urls[`logoUrl${i}`] = `/uploads/branding/logo-${i}.webp`;
      }
      const snapshot: TenantDatabaseSnapshot = {
        objects: { branding: urls },
      };

      vi.mocked(fsPromises.stat).mockResolvedValue({
        isFile: () => true,
        size: 24 * 1024 * 1024,
      } as any);

      await expect(exportBackupAssetsForSnapshot(snapshot)).rejects.toThrow(
        /Backup asset set exceeds maximum/,
      );
    });
  });

  describe("restoreTenantAssets", () => {
    it("decodes base64 assets and writes them to the upload directory", async () => {
      const testBuffer = Buffer.from("image-binary-data");
      const assets = {
        "/uploads/branding/restored-logo.webp": testBuffer.toString("base64"),
      };

      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined as any);

      await restoreTenantAssets(assets);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(join("/mock/uploads", "branding"), {
        recursive: true,
      });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        join("/mock/uploads", "branding", "restored-logo.webp"),
        testBuffer,
      );
    });

    it("handles data-uri prefixed base64 strings", async () => {
      const testBuffer = Buffer.from("avatar-data");
      const assets = {
        "/uploads/avatars/user.webp": `data:image/webp;base64,${testBuffer.toString("base64")}`,
      };

      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined as any);

      await restoreTenantAssets(assets);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        join("/mock/uploads", "avatars", "user.webp"),
        testBuffer,
      );
    });
  });
});
