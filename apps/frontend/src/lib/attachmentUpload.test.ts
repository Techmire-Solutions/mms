import { describe, expect, it, vi } from "vitest";

const mockApiJson = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  apiJson: (...args: unknown[]) => mockApiJson(...args),
}));

import { deleteAttachmentFile, uploadAttachmentFile } from "@/lib/attachmentUpload";

describe("attachmentUpload", () => {
  it("returns the server's relative attachment URL unchanged", async () => {
    mockApiJson.mockResolvedValueOnce({
      url: "/uploads/tenants/demo/attachments/a.pdf",
      name: "a.pdf",
      type: "application/pdf",
      size: 4,
    });

    const result = await uploadAttachmentFile(new File(["data"], "a.pdf"));

    expect(result.url).toBe("/uploads/tenants/demo/attachments/a.pdf");
    expect(result.url.startsWith("/")).toBe(true);
  });

  it("posts the attachment URL to the unlink endpoint", async () => {
    mockApiJson.mockResolvedValueOnce({ deleted: true });
    const url = "/uploads/tenants/demo/attachments/a.pdf";

    await expect(deleteAttachmentFile(url)).resolves.toEqual({ deleted: true });
    expect(mockApiJson).toHaveBeenCalledWith("/api/uploads/attachment/delete", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  });
});
