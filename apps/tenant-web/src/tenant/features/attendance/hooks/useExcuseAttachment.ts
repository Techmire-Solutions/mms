import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { deleteAttachmentFile, uploadAttachmentFile } from "@mms/fe-core/lib/attachmentUpload";
import { notify } from "@mms/fe-core/notify";

export interface UseExcuseAttachmentOptions {
  /** Current draft document url. */
  value: string | null;
  /** Commit a new url (null removes it). */
  onChange: (url: string | null) => void;
}

export interface UseExcuseAttachmentResult {
  uploading: boolean;
  upload: (file: File | undefined) => Promise<void>;
  remove: () => void;
  /** Drop session uploads; `keep` is the url the saved record now owns. */
  cleanup: (keep?: string | null) => void;
}

/**
 * Certificate upload lifecycle for the attendance excuse form.
 *
 * Only files uploaded during this form session may be unlinked before a save
 * commits — a certificate that belongs to a persisted record must survive a
 * cancelled edit. Replacing or removing an upload unlinks the now-unreferenced
 * file; a successful save hands ownership to the leave row.
 */
export function useExcuseAttachment({
  value,
  onChange,
}: UseExcuseAttachmentOptions): UseExcuseAttachmentResult {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const uploadedRef = useRef<Set<string>>(new Set());
  const uploadInFlightRef = useRef(false);

  const deleteUploaded = useCallback((url: string | null | undefined): void => {
    if (!url || !uploadedRef.current.delete(url)) return;
    void deleteAttachmentFile(url).catch(() => undefined);
  }, []);

  const cleanup = useCallback(
    (keep?: string | null): void => {
      for (const url of [...uploadedRef.current]) {
        if (url === keep) {
          uploadedRef.current.delete(url);
          continue;
        }
        deleteUploaded(url);
      }
    },
    [deleteUploaded],
  );

  const upload = useCallback(
    async (file: File | undefined): Promise<void> => {
      if (!file || uploadInFlightRef.current) return;
      uploadInFlightRef.current = true;
      setUploading(true);
      try {
        const result = await uploadAttachmentFile(file, "attendance_excuse");
        uploadedRef.current.add(result.url);
        onChange(result.url);
        deleteUploaded(value);
        notify.success(t("attendance.excuses.attached"));
      } catch {
        notify.error(t("attendance.excuses.attachFailed"));
      } finally {
        uploadInFlightRef.current = false;
        setUploading(false);
      }
    },
    [deleteUploaded, onChange, t, value],
  );

  const remove = useCallback((): void => {
    onChange(null);
    deleteUploaded(value);
  }, [deleteUploaded, onChange, value]);

  return { uploading, upload, remove, cleanup };
}
