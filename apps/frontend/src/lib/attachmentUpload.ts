import { type AttachmentUploadResponse } from "@mms/shared";
import { apiJson, resolveApiUrl } from "@/lib/apiClient";

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

  return {
    ...response,
    url: resolveApiUrl(response.url),
  };
}
