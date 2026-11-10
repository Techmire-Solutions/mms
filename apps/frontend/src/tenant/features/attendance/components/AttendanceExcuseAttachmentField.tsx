import React from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface AttendanceExcuseAttachmentFieldProps {
  documentRef: string | null;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
  error?: string;
}

const FILE_INPUT_ID = "attendance-excuse-file";

/** Certificate attach/remove control for the excuse form. */
export function AttendanceExcuseAttachmentField({
  documentRef,
  uploading,
  onUpload,
  onRemove,
  error,
}: AttendanceExcuseAttachmentFieldProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={t("attendance.excuses.attach")}
        onChange={(event) => onUpload(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={uploading}
          onClick={() => document.getElementById(FILE_INPUT_ID)?.click()}
        >
          <Paperclip className="me-1 h-4 w-4" aria-hidden="true" />
          {documentRef
            ? t("attendance.excuses.attached")
            : uploading
              ? t("attendance.excuses.uploading")
              : t("attendance.excuses.attach")}
        </Button>
        {documentRef && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="me-1 h-4 w-4" aria-hidden="true" />
            {t("attendance.excuses.removeAttachment")}
          </Button>
        )}
      </div>
      {error && (
        <span className="text-xs font-medium text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
