import { type AttachmentUploadResponse } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

/**
 * Uploads an attachment file to the MMS backend.
 */
export async function uploadAttachmentFile(file: File): Promise<AttachmentUploadResponse> {
  const form = new FormData();
  form.append("file", file, file.name);

  const response = await apiJson<AttachmentUploadResponse>("/api/uploads/attachment", {
    method: "POST",
    body: form,
  });

  // Store the relative path so B-04 can accept it as a tenant upload; the
  // browser resolves it against the current origin (`/uploads` is proxied in dev).
  return response;
}

/** Best-effort unlink of an attachment file after its contact row is removed. */
export async function deleteAttachmentFile(url: string): Promise<{ deleted: boolean }> {
  return apiJson<{ deleted: boolean }>("/api/uploads/attachment/delete", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
