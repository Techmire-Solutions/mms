import { type AttachmentUploadResponse } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

/** Purpose-scoped uploads: the server authorises and content-type-filters per purpose. */
export type AttachmentUploadPurpose = "contact" | "attendance_excuse" | "question_media";

/**
 * Uploads an attachment file to the MMS backend.
 *
 * `purpose` is explicit: a teacher holding `attendance.write` (but not `contacts.write`) may attach
 * an excuse certificate, and that purpose only accepts PDF/JPEG/PNG/WebP.
 */
export async function uploadAttachmentFile(
  file: File,
  purpose: AttachmentUploadPurpose = "contact",
): Promise<AttachmentUploadResponse> {
  const form = new FormData();
  form.append("file", file, file.name);

  const path =
    purpose === "contact"
      ? "/api/uploads/attachment"
      : `/api/uploads/attachment?purpose=${encodeURIComponent(purpose)}`;
  const response = await apiJson<AttachmentUploadResponse>(path, {
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
