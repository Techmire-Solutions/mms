import React, { useEffect, useState } from "react";
import { ArrowRightLeft, LogOut } from "lucide-react";
import {
  todayISO,
  type Enrollment,
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

export type EnrollmentOperationKind = "transfer" | "withdraw";

export interface EnrollmentOperationModalProps {
  kind: EnrollmentOperationKind | null;
  enrollment: Enrollment;
  /** Full session (classes with sections) for the transfer destination picker. */
  session: Session | null;
  isPending: boolean;
  onClose: () => void;
  onTransfer: (body: EnrollmentTransferBody) => Promise<boolean>;
  onWithdraw: (body: EnrollmentWithdrawBody) => Promise<boolean>;
}

/** Dated, reasoned mid-session change of an enrollment: transfer or withdrawal. */
export function EnrollmentOperationModal({
  kind,
  enrollment,
  session,
  isPending,
  onClose,
  onTransfer,
  onWithdraw,
}: EnrollmentOperationModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const today = todayISO();
  const [target, setTarget] = useState<SessionClassSectionValue>({
    sessionId: enrollment.sessionId,
    classId: "",
    sectionId: "",
  });
  const [effectiveOn, setEffectiveOn] = useState(today);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!kind) return;
    setTarget({ sessionId: enrollment.sessionId, classId: "", sectionId: "" });
    setEffectiveOn(today);
    setReason("");
  }, [kind, enrollment.sessionId, today]);

  const isTransfer = kind === "transfer";
  const reasonValid = reason.trim().length >= 3;
  const canSave =
    !isPending && reasonValid && Boolean(effectiveOn) && (!isTransfer || Boolean(target.classId));

  const submit = async () => {
    const common = { effectiveOn, reason: reason.trim() };
    const saved = isTransfer
      ? await onTransfer({
          ...common,
          classId: target.classId,
          sectionId: target.sectionId || null,
        })
      : await onWithdraw(common);
    if (saved) onClose();
  };

  return (
    <FormModal
      open={kind !== null}
      onClose={onClose}
      title={isTransfer ? t("enrollments.ops.transferTitle") : t("enrollments.ops.withdrawTitle")}
      subtitle={isTransfer ? t("enrollments.ops.transferSubtitle") : undefined}
      icon={isTransfer ? ArrowRightLeft : LogOut}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={
        isTransfer ? t("enrollments.ops.confirmTransfer") : t("enrollments.ops.confirmWithdraw")
      }
      saving={isPending}
      saveDisabled={!canSave}
      isDirty={reason.trim().length > 0 || Boolean(target.classId)}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void submit()}
    >
      <div className="space-y-4 py-1 text-start">
        {isTransfer ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SessionClassSectionSelect
              sessions={session ? [session] : []}
              value={target}
              onChange={setTarget}
              levels="section"
              idPrefix="enrollment-transfer"
              lockSession
              required
              disabled={isPending || !session}
            />
          </div>
        ) : (
          <WarningCallout density="compact" description={t("enrollments.ops.withdrawSubtitle")} />
        )}
        <Field
          id="enrollment-op-date"
          label={isTransfer ? t("enrollments.ops.effectiveOn") : t("enrollments.ops.lastDay")}
          required
        >
          <DatePicker
            id="enrollment-op-date"
            name="effectiveOn"
            value={effectiveOn}
            max={today}
            disabled={isPending}
            onChange={setEffectiveOn}
          />
        </Field>
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
