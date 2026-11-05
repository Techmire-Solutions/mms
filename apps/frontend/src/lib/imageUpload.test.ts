import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageUploadError } from "@/lib/imageUploadErrors";

const mockApiJson = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
  resolveApiUrl: (path: string) => path,
}));

import { uploadCanvasImage, uploadImageFile } from "@/lib/imageUpload";

const AVIF_BYTES = new TextEncoder().encode("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1");
const PNG_BYTES = new TextEncoder().encode("\x89PNG\r\n\x1a\n");

function imageFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as BlobPart], name, { type });
}

describe("uploadImageFile", () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    mockApiJson.mockResolvedValue({ url: "/uploads/tenants/demo/avatars/a.avif" });
  });

  it("posts the encoded file as multipart FormData with the purpose query", async () => {
    const file = imageFile(AVIF_BYTES, "avatar.avif", "image/avif");

    await expect(uploadImageFile(file, "avatar")).resolves.toBe(
      "/uploads/tenants/demo/avatars/a.avif",
    );

    const [path, init] = mockApiJson.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/uploads/image?purpose=avatar");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();

    const sent = (init.body as FormData).get("image") as File;
    expect(sent.name).toBe("avatar.avif");
    expect(sent.type).toBe("image/avif");
  });

  it("refuses non-AVIF/WebP inputs before reaching the server", async () => {
    await expect(
      uploadImageFile(imageFile(PNG_BYTES, "avatar.png", "image/png")),
    ).rejects.toMatchObject<Partial<ImageUploadError>>({ code: "unsupported_format" });
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it("refuses a file whose declared MIME does not match its bytes", async () => {
    await expect(
      uploadImageFile(imageFile(PNG_BYTES, "avatar.avif", "image/avif")),
    ).rejects.toMatchObject<Partial<ImageUploadError>>({ code: "encode_failed" });
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it("maps a server rejection to a typed error", async () => {
    mockApiJson.mockRejectedValueOnce(new Error("Image must be AVIF or WebP"));
    await expect(
      uploadImageFile(imageFile(AVIF_BYTES, "avatar.avif", "image/avif")),
    ).rejects.toMatchObject<Partial<ImageUploadError>>({
      code: "server_rejected",
      message: "Image must be AVIF or WebP",
    });
  });
});

describe("uploadCanvasImage", () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    mockApiJson.mockResolvedValue({ url: "/uploads/tenants/demo/avatars/c.avif" });
  });

  it("names the file from the actual encoded MIME", async () => {
    const canvas = {
      toBlob: (callback: BlobCallback, type?: string) => {
        callback(new Blob([AVIF_BYTES], { type: type ?? "image/avif" }));
      },
    } as unknown as HTMLCanvasElement;

    await uploadCanvasImage(canvas, "avatar");

    const init = mockApiJson.mock.calls[0]?.[1] as RequestInit;
    const sent = (init.body as FormData).get("image") as File;
    expect(sent.name).toBe("image.avif");
    expect(sent.type).toBe("image/avif");
  });
});
