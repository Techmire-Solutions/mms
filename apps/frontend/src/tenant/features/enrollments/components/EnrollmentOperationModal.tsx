import React, { useState } from "react";
import { ArrowRightLeft, LogOut, PauseCircle, RotateCcw, type LucideIcon } from "lucide-react";
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
} from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { DatePicker } from "@/components/app/DatePicker";
import { Alert } from "@/components/app/Alert";
import { Textarea } from "@/components/ui/textarea";
import { FORM_INPUT } from "@/components/ui/formStyles";
import {
  SessionClassSectionSelect,
  type SessionClassSectionValue,
} from "@/components/common/SessionClassSectionSelect";
import { useTranslation } from "@/hooks/useTranslation";

export type EnrollmentOperationKind = "transfer" | "withdraw" | "readmit" | "suspend";

interface KindConfig {
  title: AppTranslationKey;
  subtitle?: AppTranslationKey;
  callout?: AppTranslationKey;
  icon: LucideIcon;
  save: AppTranslationKey;
  dateLabel: AppTranslationKey;
  /** Destination picker: required (transfer), optional prefilled (readmit) or hidden. */
  picker?: "required" | "optional";
}

const KINDS: Record<EnrollmentOperationKind, KindConfig> = {
  transfer: {
    title: "enrollments.ops.transferTitle",
    subtitle: "enrollments.ops.transferSubtitle",
    icon: ArrowRightLeft,
    save: "enrollments.ops.confirmTransfer",
    dateLabel: "enrollments.ops.effectiveOn",
    picker: "required",
  },
  withdraw: {
    title: "enrollments.ops.withdrawTitle",
    callout: "enrollments.ops.withdrawSubtitle",
    icon: LogOut,
    save: "enrollments.ops.confirmWithdraw",
    dateLabel: "enrollments.ops.lastDay",
  },
  readmit: {
    title: "enrollments.ops.readmitTitle",
    subtitle: "enrollments.ops.readmitSubtitle",
    icon: RotateCcw,
    save: "enrollments.ops.confirmReadmit",
    dateLabel: "enrollments.ops.effectiveOn",
    picker: "optional",
  },
  suspend: {
    title: "enrollments.ops.suspendTitle",
    callout: "enrollments.ops.suspendSubtitle",
    icon: PauseCircle,
    save: "enrollments.ops.confirmSuspend",
    dateLabel: "enrollments.ops.leaveFrom",
  },
};

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
  const config = KINDS[kind ?? "transfer"];
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
  const [prevOperationKey, setPrevOperationKey] = useState(operationKey);
  if (prevOperationKey !== operationKey) {
    setPrevOperationKey(operationKey);
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
  }
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

  const submit = async () => {
    const trimmed = reason.trim();
    const destination = { classId: target.classId, sectionId: target.sectionId || null };
    setFormError(null);
    let saved = false;
    if (kind === "transfer") {
      const parsed = enrollmentTransferBodySchema.safeParse({
        ...destination,
        effectiveOn: day,
        reason: trimmed,
      });
      if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? null);
      saved = await props.onTransfer(parsed.data);
    } else if (kind === "withdraw") {
      const parsed = enrollmentWithdrawBodySchema.safeParse({
        effectiveOn: day,
        reason: trimmed,
        ...(reasonCode
          ? { reasonCode: reasonCode as (typeof ENROLLMENT_DROP_REASON_CODES)[number] }
          : {}),
      });
      if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? null);
      saved = await props.onWithdraw(parsed.data);
    } else if (kind === "readmit") {
      const parsed = enrollmentReadmitBodySchema.safeParse({
        ...destination,
        effectiveOn: day,
        reason: trimmed,
      });
      if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? null);
      saved = await props.onReadmit(parsed.data);
    } else if (kind === "suspend") {
      const parsed = enrollmentSuspendBodySchema.safeParse({
        fromOn: day,
        toOn: toDay,
        reason: trimmed,
      });
      if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? null);
      saved = await props.onSuspend(parsed.data);
    }
    if (saved) onClose();
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
      onSave={() => void submit()}
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
              min={kind === "suspend" ? undefined : (enrollment.startOn ?? enrollment.enrolledDate)}
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
            <select
              id="enrollment-op-drop-reason"
              name="dropReasonCode"
              className={FORM_INPUT}
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              <option value="">{t("common.none")}</option>
              {ENROLLMENT_DROP_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`enrollments.ops.dropReason.${code}` as AppTranslationKey)}
                </option>
              ))}
            </select>
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
            className={FORM_INPUT}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>
    </FormModal>
  );
}
