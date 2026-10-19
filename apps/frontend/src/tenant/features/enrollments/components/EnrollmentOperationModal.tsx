import React, { useEffect, useState } from "react";
import { ArrowRightLeft, LogOut, PauseCircle, RotateCcw, type LucideIcon } from "lucide-react";
import {
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
import { WarningCallout } from "@/components/app/WarningCallout";
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
  const [target, setTarget] = useState<SessionClassSectionValue>({
    sessionId,
    classId: "",
    sectionId: "",
  });
  const [day, setDay] = useState(today);
  const [toDay, setToDay] = useState(today);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!kind) return;
    setTarget({
      sessionId,
      classId: readmitting ? currentClassId : "",
      sectionId: readmitting ? (currentSectionId ?? "") : "",
    });
    setDay(today);
    setToDay(today);
    setReason("");
  }, [kind, readmitting, sessionId, currentClassId, currentSectionId, today]);

  const reasonValid = reason.trim().length >= 3;
  const rangeValid = kind !== "suspend" || toDay >= day;
  const canSave =
    !isPending &&
    reasonValid &&
    Boolean(day) &&
    rangeValid &&
    (config.picker !== "required" || Boolean(target.classId));

  const submit = async () => {
    const trimmed = reason.trim();
    const destination = { classId: target.classId, sectionId: target.sectionId || null };
    let saved = false;
    if (kind === "transfer")
      saved = await props.onTransfer({ ...destination, effectiveOn: day, reason: trimmed });
    else if (kind === "withdraw")
      saved = await props.onWithdraw({ effectiveOn: day, reason: trimmed });
    else if (kind === "readmit")
      saved = await props.onReadmit({ ...destination, effectiveOn: day, reason: trimmed });
    else if (kind === "suspend")
      saved = await props.onSuspend({ fromOn: day, toOn: toDay, reason: trimmed });
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
      isDirty={reason.trim().length > 0}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void submit()}
    >
      <div className="space-y-4 py-1 text-start">
        {config.callout ? (
          <WarningCallout density="compact" description={t(config.callout)} />
        ) : null}
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
          </div>
        ) : null}
        <div className={kind === "suspend" ? "grid gap-4 sm:grid-cols-2" : undefined}>
          <Field id="enrollment-op-date" label={t(config.dateLabel)} required>
            <DatePicker
              id="enrollment-op-date"
              name="effectiveOn"
              value={day}
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
