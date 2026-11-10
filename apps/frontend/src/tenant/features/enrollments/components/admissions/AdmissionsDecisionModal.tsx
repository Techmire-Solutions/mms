import React, { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  registrationReviewSchema,
  type RegistrationApplication,
  type RegistrationReview,
} from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { Textarea } from "@/components/ui/textarea";
import { ToggleRow } from "@shared/ui";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";

export type AdmissionsDecision = RegistrationReview["decision"];

export interface AdmissionsDecisionModalProps {
  open: boolean;
  decision: AdmissionsDecision;
  applications: readonly RegistrationApplication[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: (body: RegistrationReview) => Promise<boolean>;
}

/** Confirms a review decision; reject needs a reason, approval can reuse a matched student. */
export function AdmissionsDecisionModal({
  open,
  decision,
  applications,
  isPending,
  onClose,
  onConfirm,
}: AdmissionsDecisionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [useMatch, setUseMatch] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const single = applications.length === 1 ? applications[0] : null;
  const matchedStudentId = single?.matchedStudentId ?? null;
  const ineligible = applications.filter((app) => app.eligibilityReasons.length > 0).length;
  const reasonRequired = decision === "reject";
  const trimmedReason = reason.trim();
  const reasonError =
    attempted && reasonRequired && trimmedReason.length < 3
      ? t("enrollments.admissions.rejectReasonRequired")
      : attempted && trimmedReason.length > 500
        ? t("enrollments.admissions.reasonTooLong")
        : undefined;

  // Clear the previous decision's reason/match choice on each (re)open (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setReason("");
      setUseMatch(true);
      setAttempted(false);
      setFormError(null);
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t(`enrollments.admissions.decision.${decision}`)}
      subtitle={
        single
          ? `${single.fullName} · ${single.reference}`
          : t("enrollments.admissions.selectedCount", { count: applications.length })
      }
      icon={ClipboardCheck}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t(`enrollments.admissions.confirm.${decision}`)}
      saving={isPending}
      saveDisabled={isPending || Boolean(reasonError)}
      error={formError ?? undefined}
      isDirty={Boolean(reason.trim())}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.admissions.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() =>
        void (async () => {
          setAttempted(true);
          const parsed = registrationReviewSchema.safeParse({
            ids: applications.map((app) => app.id),
            decision,
            reason: trimmedReason || null,
            existingStudentId: decision === "approve" && useMatch ? matchedStudentId : null,
          });
          if (!parsed.success) {
            setFormError(parsed.error.issues[0]?.message ?? t("enrollments.toast.saveFailed"));
            return;
          }
          const done = await onConfirm(parsed.data);
          if (done) onClose();
          else setFormError(t("enrollments.toast.saveFailed"));
        })()
      }
    >
      <div className="space-y-3 py-1 text-start">
        {decision === "approve" && ineligible > 0 ? (
          <Alert title={t("enrollments.admissions.ineligibleWarning", { count: ineligible })} />
        ) : null}
        {decision === "approve" && matchedStudentId ? (
          <ToggleRow
            label={t("enrollments.admissions.useMatch")}
            description={t("enrollments.admissions.useMatchHint")}
            value={useMatch}
            onChange={setUseMatch}
          />
        ) : null}
        {decision === "approve" ? (
          <p className="text-pretty text-sm text-muted-foreground">
            {t("enrollments.admissions.approveHint")}
          </p>
        ) : null}
        <Field
          id="admissions-reason"
          label={t("enrollments.admissions.reason")}
          required={reasonRequired}
          error={reasonError}
        >
          <Textarea
            id="admissions-reason"
            name="reason"
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
