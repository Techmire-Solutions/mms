import React, { useState } from "react";
import { LockKeyhole } from "lucide-react";
import type { PostingPeriod } from "@mms/contracts";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/ui";
import { Textarea } from "@mms/ui";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import { useTranslation } from "@mms/fe-core/i18n";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";

export interface AccountingPostingPeriodActionModalProps {
  period: PostingPeriod;
  action: "close" | "reopen";
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}

/** Reason form for closing/reopening a monthly posting period. */
export function AccountingPostingPeriodActionModal({
  period,
  action,
  saving,
  onClose,
  onConfirm,
}: AccountingPostingPeriodActionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isClose = action === "close";
  // The dialog is mounted per period/action; a typed reason triggers the discard confirm.
  const { isDirty } = useDirtySnapshot(reason, `true:${period.id}:${action}`, "");

  const handleSave = async (): Promise<void> => {
    setError(null);
    try {
      await onConfirm(reason.trim() || undefined);
    } catch (saveError) {
      setError(
        accountingErrorMessage(saveError) ?? t("accounting.settings.postingPeriods.saveFailed"),
      );
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={t(
        isClose
          ? "accounting.settings.postingPeriods.closeTitle"
          : "accounting.settings.postingPeriods.reopenTitle",
      )}
      subtitle={period.label}
      icon={LockKeyhole}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t(
        isClose
          ? "accounting.settings.postingPeriods.close"
          : "accounting.settings.postingPeriods.reopen",
      )}
      onSave={handleSave}
      saving={saving}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      error={error ?? undefined}
      formId="posting-period-action-form"
    >
      <form
        id="posting-period-action-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="space-y-3"
      >
        <p className="m-0 text-xs text-muted-foreground text-pretty">
          {t(
            isClose
              ? "accounting.settings.postingPeriods.closeHint"
              : "accounting.settings.postingPeriods.reopenHint",
            { start: period.startDate, end: period.endDate },
          )}
        </p>
        <Field
          id="posting-period-reason"
          label={t("accounting.settings.postingPeriods.reason")}
          hint={t("accounting.settings.postingPeriods.reasonHint")}
        >
          <Textarea
            id="posting-period-reason"
            name="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </FormModal>
  );
}
