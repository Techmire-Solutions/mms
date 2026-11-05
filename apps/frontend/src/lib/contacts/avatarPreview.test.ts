import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_UPLOAD_MAX_INPUT_BYTES } from "@mms/shared";
import { prepareAvatarPreview } from "./avatarPreview";

describe("prepareAvatarPreview", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("returns a revocable object URL for a valid image", async () => {
    const preview = await prepareAvatarPreview(
      new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(preview.url).toBe("blob:preview");
    preview.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("rejects oversized files before creating the preview URL", async () => {
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
