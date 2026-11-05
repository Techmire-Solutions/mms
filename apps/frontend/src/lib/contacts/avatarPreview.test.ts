import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_UPLOAD_MAX_INPUT_BYTES } from "@mms/shared";
import { prepareAvatarPreview } from "./avatarPreview";

const mockHeic2Any = vi.fn();
vi.mock("heic2any", () => ({ default: (...args: unknown[]) => mockHeic2Any(...args) }));

describe("prepareAvatarPreview", () => {
  beforeEach(() => {
    mockHeic2Any.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("returns a revocable object URL for a normal image", async () => {
    const preview = await prepareAvatarPreview(
      new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(preview.url).toBe("blob:preview");
    preview.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(mockHeic2Any).not.toHaveBeenCalled();
  });

  it("converts HEIC through heic2any before creating the preview URL", async () => {
    mockHeic2Any.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    await prepareAvatarPreview(new File(["heic"], "photo.heic", { type: "image/heic" }));

    expect(mockHeic2Any).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized files before decoding", async () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: IMAGE_UPLOAD_MAX_INPUT_BYTES + 1 });

    await expect(prepareAvatarPreview(file)).rejects.toMatchObject({ code: "too_large" });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects non-image files with an unsupported-format error", async () => {
    await expect(
      prepareAvatarPreview(new File(["pdf"], "doc.pdf", { type: "application/pdf" })),
    ).rejects.toMatchObject({ code: "unsupported_format" });
  });
});
