import React, { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { ATTENDANCE_LEAVE_TYPES } from "@mms/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { uploadAttachmentFile } from "@/lib/attachmentUpload";
import { useAttendanceExcuses } from "@/tenant/features/attendance/hooks/useAttendanceLifecycle";

/** A dated day string; the server validates the range again, this only avoids empty submits. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Files an excuse request, optionally with a certificate.
 *
 * The certificate uploads first (purpose `attendance_excuse`, so a teacher with attendance.write may
 * attach one and only PDF/JPEG/PNG/WebP are accepted), then its tenant path is submitted as the
 * leave's `documentRef`.
 */
export function AttendanceExcuseForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const excuses = useAttendanceExcuses();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [studentId, setStudentId] = useState("");
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [leaveType, setLeaveType] = useState<(typeof ATTENDANCE_LEAVE_TYPES)[number]>("medical");
  const [reason, setReason] = useState("");
  const [documentRef, setDocumentRef] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadAttachmentFile(file, "attendance_excuse");
      setDocumentRef(result.url);
      notify.success(t("attendance.excuses.attached"));
    } catch {
      notify.error(t("attendance.excuses.attachFailed"));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    excuses.submit.mutate(
      {
        body: {
          studentId: studentId.trim(),
          fromDate,
          toDate,
          reason: reason.trim(),
          leaveType,
          notes: "",
          ...(documentRef ? { documentRef } : {}),
        },
      },
      { onSuccess: onDone },
    );
  };

  const canSubmit =
    studentId.trim().length > 0 && reason.trim().length > 0 && fromDate <= toDate && !uploading;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("attendance.excuses.student")}>
          <Input
            className={FORM_INPUT}
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder={t("attendance.excuses.studentPlaceholder")}
          />
        </Field>
        <Field label={t("attendance.excuses.type")}>
          <select
            className={FORM_INPUT}
            value={leaveType}
            onChange={(event) =>
              setLeaveType(event.target.value as (typeof ATTENDANCE_LEAVE_TYPES)[number])
            }
          >
            {ATTENDANCE_LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`attendance.excuses.type.${type}` as "attendance.excuses.type.medical")}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("attendance.excuses.from")}>
          <Input
            className={FORM_INPUT}
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </Field>
        <Field label={t("attendance.excuses.to")}>
          <Input
            className={FORM_INPUT}
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t("attendance.excuses.reason")}>
        <Input
          className={FORM_INPUT}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label={t("attendance.excuses.attach")}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="me-1 h-4 w-4" aria-hidden="true" />
          {documentRef
            ? t("attendance.excuses.attached")
            : uploading
              ? t("attendance.excuses.uploading")
              : t("attendance.excuses.attach")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || excuses.submit.isPending}
          onClick={submit}
        >
          {t("attendance.excuses.submit")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t("attendance.excuses.close")}
        </Button>
      </div>
    </div>
  );
}
