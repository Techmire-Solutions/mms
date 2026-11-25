import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import React, { useState } from "react";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import {
  ENROLLMENT_DROP_REASON_CODES,
  enrollmentReadmitBodySchema,
  enrollmentSuspendBodySchema,
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
  todayISO,
  type AppTranslationKey,
  type Enrollment,
  type EnrollmentReadmitBody,
  type EnrollmentSuspendBody,
  type EnrollmentTransferBody,
  type EnrollmentWithdrawBody,
  type Session,
} from "@mms/contracts";
import { Field, FormSelect } from "@mms/fe-core/components/FormPrimitives";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { Alert } from "@mms/ui";
import { Textarea } from "@mms/ui";
import {
  SessionClassSectionSelect,
  type SessionClassSectionValue,
} from "@/components/common/SessionClassSectionSelect";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  ENROLLMENT_OPERATION_KINDS,
  type EnrollmentOperationKind,
} from "@/tenant/features/enrollments/lib/enrollmentOperationKinds";
import { resolveEnrollmentApiError } from "@mms/fe-core/forms/resolveEnrollmentApiError";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";

export type { EnrollmentOperationKind };

export interface EnrollmentOperationModalProps {
  kind: EnrollmentOperationKind | null;
  enrollment: Enrollment;
  /** Full session (classes with sections) for the destination picker. */
  session: Session | null;
  isPending: boolean;
  onClose: () => void;
  onTransfer: (body: EnrollmentTransferBody) => Promise<boolean>;
  onWithdraw: (body: EnrollmentWithdrawBody) => Promise<boolean>;
  onReadmit: (body: EnrollmentReadmitBody) => Promise<boolean>;
  onSuspend: (body: EnrollmentSuspendBody) => Promise<boolean>;
}

/** Dated, reasoned mid-session change of an enrollment: transfer, withdraw, re-admit or suspend. */
export function EnrollmentOperationModal(props: EnrollmentOperationModalProps): React.JSX.Element {
  const { kind, enrollment, session, isPending, onClose } = props;
  const { t } = useTranslation();
  const today = todayISO();
  const config = ENROLLMENT_OPERATION_KINDS[kind ?? "transfer"];
  const readmitting = kind === "readmit";
  const { sessionId, classId: currentClassId, sectionId: currentSectionId } = enrollment;
  const [target, setTarget] = useState<SessionClassSectionValue>(() => ({
    sessionId,
    // Re-admitting resumes the class/section the enrollment left; the other ops start blank.
    classId: readmitting ? currentClassId : "",
    sectionId: readmitting ? (currentSectionId ?? "") : "",
  }));
  const [day, setDay] = useState(today);
  const [toDay, setToDay] = useState(today);
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Fresh operation draft whenever the operation or the enrollment being changed changes.
  const operationKey = `${kind}|${sessionId}|${currentClassId}|${currentSectionId}|${today}`;
  useIdentityReset(operationKey, () => {
    if (kind) {
      setTarget({
        sessionId,
        classId: readmitting ? currentClassId : "",
        sectionId: readmitting ? (currentSectionId ?? "") : "",
      });
      setDay(today);
      setToDay(today);
      setReason("");
      setReasonCode("");
      setFormError(null);
    }
  });
  const reasonValid = reason.trim().length >= 3;
  const rangeValid = kind !== "suspend" || toDay >= day;
  const targetClass = session?.classes?.find((cls) => cls.id === target.classId);
  const needsSection = (targetClass?.sections?.length ?? 0) > 0;
  const canSave =
    !isPending &&
    reasonValid &&
    Boolean(day) &&
    rangeValid &&
    (config.picker !== "required" || Boolean(target.classId)) &&
    (!needsSection || Boolean(target.sectionId));
  const dirty = Boolean(
    reason.trim() ||
    reasonCode ||
    target.classId ||
    target.sectionId ||
    day !== today ||
    toDay !== today,
  );

  const submit = useSubmitGuard();

  const handleSubmit = async (): Promise<void> => {
    await submit(async () => {
      if (!canSave) return;
      const trimmed = reason.trim();
      const destination = { classId: target.classId, sectionId: target.sectionId || null };
      setFormError(null);
      try {
        let saved = false;
        if (kind === "transfer") {
          const parsed = enrollmentTransferBodySchema.safeParse({
            ...destination,
            effectiveOn: day,
            reason: trimmed,
          });
          if (!parsed.success)
            return setFormError(translateValidationMessage(parsed.error.issues[0]?.message, t));
          saved = await props.onTransfer(parsed.data);
        } else if (kind === "withdraw") {
          const parsed = enrollmentWithdrawBodySchema.safeParse({
            effectiveOn: day,
            reason: trimmed,
            ...(reasonCode
              ? { reasonCode: reasonCode as (typeof ENROLLMENT_DROP_REASON_CODES)[number] }
              : {}),
          });
          if (!parsed.success)
            return setFormError(translateValidationMessage(parsed.error.issues[0]?.message, t));
          saved = await props.onWithdraw(parsed.data);
        } else if (kind === "readmit") {
          const parsed = enrollmentReadmitBodySchema.safeParse({
            ...destination,
            effectiveOn: day,
            reason: trimmed,
          });
          if (!parsed.success)
            return setFormError(translateValidationMessage(parsed.error.issues[0]?.message, t));
          saved = await props.onReadmit(parsed.data);
        } else if (kind === "suspend") {
          const parsed = enrollmentSuspendBodySchema.safeParse({
            fromOn: day,
            toOn: toDay,
            reason: trimmed,
          });
          if (!parsed.success)
            return setFormError(translateValidationMessage(parsed.error.issues[0]?.message, t));
          saved = await props.onSuspend(parsed.data);
        }
        if (saved) onClose();
      } catch (error) {
        setFormError(resolveEnrollmentApiError(error, t) ?? t("common.formPleaseFixErrors"));
      }
    });
  };
  return (
    <FormModal
      open={kind !== null}
      onClose={onClose}
      title={t(config.title)}
      subtitle={config.subtitle ? t(config.subtitle) : undefined}
      icon={config.icon}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t(config.save)}
      saving={isPending}
      saveDisabled={!canSave}
      isDirty={dirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      error={formError ?? undefined}
      onSave={() => void handleSubmit()}
      formId="enrollment-operation-form"
    >
      <form
        id="enrollment-operation-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // No local validity pre-check: the guarded handler early-returns on
          // `!canSave` and schema errors must stay reachable from Enter.
          void handleSubmit();
        }}
      >
        <div className="space-y-4 py-1 text-start">
          {config.callout ? <Alert density="compact" description={t(config.callout)} /> : null}
          {config.picker ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <SessionClassSectionSelect
                sessions={session ? [session] : []}
                value={target}
                onChange={setTarget}
                levels="section"
                idPrefix="enrollment-transfer"
                lockSession
                required={config.picker === "required"}
                disabled={isPending || !session}
              />
              {needsSection && !target.sectionId ? (
                <p role="status" className="text-xs text-muted-foreground sm:col-span-3">
                  {t("enrollments.ops.chooseSection")}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className={kind === "suspend" ? "grid gap-4 sm:grid-cols-2" : undefined}>
            <Field id="enrollment-op-date" label={t(config.dateLabel)} required>
              <DatePicker
                id="enrollment-op-date"
                name="effectiveOn"
                value={day}
                min={
                  kind === "suspend" ? undefined : (enrollment.startOn ?? enrollment.enrolledDate)
                }
                max={kind === "suspend" ? undefined : today}
                disabled={isPending}
                onChange={setDay}
              />
            </Field>
            {kind === "suspend" ? (
              <Field
                id="enrollment-op-to"
                label={t("enrollments.ops.leaveTo")}
                error={rangeValid ? undefined : t("enrollments.ops.rangeInvalid")}
                required
              >
                <DatePicker
                  id="enrollment-op-to"
                  name="toOn"
                  value={toDay}
                  min={day || undefined}
                  disabled={isPending}
                  onChange={setToDay}
                />
              </Field>
            ) : null}
          </div>
          {kind === "withdraw" ? (
            <Field id="enrollment-op-drop-reason" label={t("enrollments.ops.dropReason")}>
              <FormSelect
                id="enrollment-op-drop-reason"
                name="dropReasonCode"
                value={reasonCode}
                onChange={setReasonCode}
                placeholder={t("common.none")}
                options={ENROLLMENT_DROP_REASON_CODES.map((code) => ({
                  value: code,
                  label: t(`enrollments.ops.dropReason.${code}` as AppTranslationKey),
                }))}
              />
            </Field>
          ) : null}
          <Field
            id="enrollment-op-reason"
            label={t("enrollments.ops.reason")}
            hint={t("enrollments.ops.reasonHint")}
            error={reason && !reasonValid ? t("enrollments.ops.reasonRequired") : undefined}
            required
          >
            <Textarea
              id="enrollment-op-reason"
              name="reason"
              rows={3}
              maxLength={500}
              value={reason}
              disabled={isPending}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
      </form>
    </FormModal>
  );
}
