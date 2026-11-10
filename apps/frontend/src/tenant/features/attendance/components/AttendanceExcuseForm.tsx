import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import {
  ATTENDANCE_LEAVE_TYPES,
  attendanceLeaveInsertSchema,
  todayISO,
  type AppTranslationKey,
  type AttendanceLeaveInsert,
} from "@mms/shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { DatePicker } from "@/components/app/DatePicker";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { deleteAttachmentFile, uploadAttachmentFile } from "@/lib/attachmentUpload";
import { notify } from "@/lib/notify";
import { useAttendanceExcuses } from "@/tenant/features/attendance/hooks/useAttendanceLifecycle";
import {
  serverFormError,
  validateAttendanceDraft,
} from "@/tenant/features/attendance/lib/attendanceFormValidation";
import { AttendanceExcuseStudentField } from "./AttendanceExcuseStudentField";
import { AttendanceExcuseAttachmentField } from "./AttendanceExcuseAttachmentField";

export interface AttendanceExcuseFormProps {
  open: boolean;
  onClose: () => void;
}

interface ExcuseDraft {
  studentId: string;
  fromDate: string;
  toDate: string;
  leaveType: AttendanceLeaveInsert["leaveType"];
  reason: string;
  notes: string;
  documentRef: string | null;
}

function emptyDraft(): ExcuseDraft {
  // `todayISO()` is workspace-local; the old `toISOString()` slice defaulted to yesterday for a
  // UTC+5 school during the first five hours of the day.
  const today = todayISO();
  return {
    studentId: "",
    fromDate: today,
    toDate: today,
    leaveType: "medical",
    reason: "",
    notes: "",
    documentRef: null,
  };
}

/**
 * Files an excuse request, optionally with a certificate.
 *
 * The draft is validated with the shared `attendanceLeaveInsertSchema` before the mutation; the
 * certificate uploads first (purpose `attendance_excuse`, so only PDF/JPEG/PNG/WebP are accepted) and
 * its tenant path travels as `documentRef`. Removing the certificate deletes the uploaded file.
 */
export function AttendanceExcuseForm({
  open,
  onClose,
}: AttendanceExcuseFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const excuses = useAttendanceExcuses();
  const [draft, setDraft] = useState<ExcuseDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);

  const update = <K extends keyof ExcuseDraft>(key: K, value: ExcuseDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setTouched(true);
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    if (formError) setFormError("");
  };

  const isDirty =
    draft.studentId.length > 0 ||
    draft.reason.trim().length > 0 ||
    draft.notes.trim().length > 0 ||
    draft.documentRef !== null ||
    draft.leaveType !== "medical" ||
    draft.fromDate !== todayISO() ||
    draft.toDate !== todayISO();

  const reset = (): void => {
    setDraft(emptyDraft());
    setFieldErrors({});
    setFormError("");
    setTouched(false);
  };

  const close = (): void => {
    reset();
    onClose();
  };

  const upload = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadAttachmentFile(file, "attendance_excuse");
      setDraft((current) => ({ ...current, documentRef: result.url }));
      notify.success(t("attendance.excuses.attached"));
    } catch {
      notify.error(t("attendance.excuses.attachFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (): Promise<void> => {
    const url = draft.documentRef;
    setDraft((current) => ({ ...current, documentRef: null }));
    if (!url) return;
    try {
      await deleteAttachmentFile(url);
    } catch {
      // The reference is already gone from the draft; a leftover file is not user-blocking.
    }
  };

  const submit = (): void => {
    const candidate = {
      studentId: draft.studentId,
      fromDate: draft.fromDate,
      toDate: draft.toDate,
      reason: draft.reason.trim(),
      leaveType: draft.leaveType,
      notes: draft.notes.trim(),
      ...(draft.documentRef ? { documentRef: draft.documentRef } : {}),
    };
    const validation = validateAttendanceDraft(attendanceLeaveInsertSchema, candidate, (message) =>
      t(message as AppTranslationKey),
    );
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      setFormError(validation.message);
      setTouched(true);
      return;
    }
    excuses.submit.mutate(
      { body: validation.data! },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: (error: unknown) => {
          const mapped = serverFormError(error, (message) => t(message as AppTranslationKey));
          setFieldErrors(mapped.fieldErrors);
          setFormError(mapped.message || t("attendance.excuses.submitFailed"));
        },
      },
    );
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title={t("attendance.excuses.new")}
      subtitle={t("attendance.excuses.formSubtitle")}
      icon={Paperclip}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("attendance.excuses.submit")}
      saving={excuses.submit.isPending || uploading}
      saveDisabled={excuses.submit.isPending || uploading}
      error={touched ? formError || undefined : undefined}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("attendance.excuses.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={submit}
    >
      <div className="space-y-4 py-1 text-start">
        <AttendanceExcuseStudentField
          value={draft.studentId}
          onChange={(value) => update("studentId", value)}
          error={fieldErrors.studentId}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="attendance-excuse-type"
            label={t("attendance.excuses.type")}
            required
            error={fieldErrors.leaveType}
          >
            <FormSelect
              id="attendance-excuse-type"
              name="leaveType"
              value={draft.leaveType}
              onChange={(value) =>
                update(
                  "leaveType",
                  (ATTENDANCE_LEAVE_TYPES as readonly string[]).includes(value)
                    ? (value as ExcuseDraft["leaveType"])
                    : "other",
                )
              }
              options={ATTENDANCE_LEAVE_TYPES.map((type) => ({
                value: type,
                label: t(`attendance.excuses.type.${type}` as AppTranslationKey),
              }))}
            />
          </Field>
          <Field
            id="attendance-excuse-from"
            label={t("attendance.excuses.from")}
            required
            error={fieldErrors.fromDate}
          >
            <DatePicker
              id="attendance-excuse-from"
              name="fromDate"
              value={draft.fromDate}
              onChange={(value) => {
                update("fromDate", value);
                if (!draft.toDate || draft.toDate < value) update("toDate", value);
              }}
            />
          </Field>
          <Field
            id="attendance-excuse-to"
            label={t("attendance.excuses.to")}
            required
            error={fieldErrors.toDate}
          >
            <DatePicker
              id="attendance-excuse-to"
              name="toDate"
              value={draft.toDate}
              min={draft.fromDate || undefined}
              aria-invalid={Boolean(fieldErrors.toDate) || undefined}
              onChange={(value) => update("toDate", value)}
            />
          </Field>
          <Field
            id="attendance-excuse-reason"
            label={t("attendance.excuses.reason")}
            required
            error={fieldErrors.reason}
          >
            <Input
              id="attendance-excuse-reason"
              name="reason"
              value={draft.reason}
              maxLength={500}
              enterKeyHint="next"
              aria-invalid={Boolean(fieldErrors.reason) || undefined}
              onChange={(event) => update("reason", event.target.value)}
              className={FORM_INPUT}
            />
          </Field>
        </div>
        <Field id="attendance-excuse-notes" label={t("attendance.excuses.notes")}>
          <Textarea
            id="attendance-excuse-notes"
            name="notes"
            value={draft.notes}
            rows={2}
            maxLength={1000}
            onChange={(event) => update("notes", event.target.value)}
          />
        </Field>
        <AttendanceExcuseAttachmentField
          documentRef={draft.documentRef}
          uploading={uploading}
          onUpload={(file) => void upload(file)}
          onRemove={() => void removeAttachment()}
          error={fieldErrors.documentRef}
        />
      </div>
    </FormModal>
  );
}
