import React, { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import type { RegistrationApplication, RegistrationReview } from "@mms/shared";
import { Field } from "@/components/ui/FormPrimitives";
import { FormModal } from "@/components/ui/FormModal";
import { Textarea } from "@/components/ui/textarea";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { WarningCallout } from "@/components/ui/WarningCallout";
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
export function AdmissionsDecisionModal({ open, decision, applications, isPending, onClose, onConfirm }: AdmissionsDecisionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [useMatch, setUseMatch] = useState(true);
  const single = applications.length === 1 ? applications[0] : null;
  const matchedStudentId = single?.matchedStudentId ?? null;
  const ineligible = applications.filter((app) => app.eligibilityReasons.length > 0).length;
  const reasonRequired = decision === "reject";

  useEffect(() => {
    if (!open) return;
    setReason("");
    setUseMatch(true);
  }, [open]);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t(`enrollments.admissions.decision.${decision}`)}
      subtitle={single ? `${single.fullName} · ${single.reference}` : t("enrollments.admissions.selectedCount", { count: applications.length })}
      icon={ClipboardCheck}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t(`enrollments.admissions.confirm.${decision}`)}
      saving={isPending}
      saveDisabled={isPending || (reasonRequired && reason.trim().length < 3)}
      isDirty={Boolean(reason.trim())}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.admissions.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void (async () => {
        const done = await onConfirm({
          ids: applications.map((app) => app.id),
          decision,
          reason: reason.trim() || null,
          existingStudentId: decision === "approve" && useMatch ? matchedStudentId : null,
        });
        if (done) onClose();
      })()}
    >
      <div className="space-y-3 py-1 text-start">
        {decision === "approve" && ineligible > 0 ? (
          <WarningCallout title={t("enrollments.admissions.ineligibleWarning", { count: ineligible })} />
        ) : null}
        {decision === "approve" && matchedStudentId ? (
          <ToggleRow label={t("enrollments.admissions.useMatch")} description={t("enrollments.admissions.useMatchHint")} value={useMatch} onChange={setUseMatch} />
        ) : null}
        {decision === "approve" ? <p className="text-pretty text-sm text-muted-foreground">{t("enrollments.admissions.approveHint")}</p> : null}
        <Field id="admissions-reason" label={t("enrollments.admissions.reason")} required={reasonRequired}>
          <Textarea id="admissions-reason" name="reason" rows={3} maxLength={500} value={reason} disabled={isPending}
            onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}
