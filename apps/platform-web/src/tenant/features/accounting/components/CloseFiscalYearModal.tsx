import React, { useMemo, useState } from "react";
import type { Account, FiscalYear } from "@mms/contracts";
import { Lock } from "lucide-react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Field } from "@mms/ui";
import { Alert } from "@mms/ui";
import { useCloseFiscalYear } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import { notify } from "@mms/fe-core/notify";
import type { TranslationFunction } from "@mms/fe-core/i18n";

export interface CloseFiscalYearModalProps {
  closeTarget: FiscalYear | null;
  accounts: Account[];
  preferredRetainedEarningsAccount?: string;
  onClose: () => void;
  onCloseSuccess: (updatedYear: FiscalYear) => void | Promise<void>;
  t: TranslationFunction;
}

export function CloseFiscalYearModal({
  closeTarget,
  accounts,
  preferredRetainedEarningsAccount,
  onClose,
  onCloseSuccess,
  t,
}: CloseFiscalYearModalProps): React.JSX.Element | null {
  const closeFiscalYear = useCloseFiscalYear();
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  // Closing a year is irreversible; a same-frame double click must not re-post.
  const guardClose = useSubmitGuard();

  const equityAccountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.type === "Equity" && account.isActive !== false)
        .sort((firstAccount, secondAccount) => firstAccount.code.localeCompare(secondAccount.code))
        .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` })),
    [accounts],
  );

  const [closeAccountId, setCloseAccountId] = useState(() =>
    closeTarget &&
    equityAccountOptions.some((option) => option.value === preferredRetainedEarningsAccount)
      ? (preferredRetainedEarningsAccount ?? "")
      : "",
  );

  // Re-seed the retained-earnings selection whenever the modal is opened for a
  // different year (or the preferred account/options change), during render
  // instead of in an effect. Compared by content so an equal-value rerender of
  // `accounts` cannot loop through the guard.
  const closeTargetKey = closeTarget
    ? [
        "open",
        closeTarget.id ?? "",
        closeTarget.label,
        closeTarget.startDate,
        closeTarget.endDate,
      ].join(":")
    : "closed";
  const optionsKey = equityAccountOptions.map((option) => option.value).join("|");
  const resetKey = `${closeTargetKey}|${preferredRetainedEarningsAccount ?? ""}|${optionsKey}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    if (closeTarget) {
      setCloseAccountId(
        equityAccountOptions.some((option) => option.value === preferredRetainedEarningsAccount)
          ? (preferredRetainedEarningsAccount ?? "")
          : "",
      );
      setCloseError(null);
    }
  }

  // The account the render-time reset above produces — used as the dirty baseline.
  const resetCloseAccountId =
    closeTarget &&
    equityAccountOptions.some((option) => option.value === preferredRetainedEarningsAccount)
      ? (preferredRetainedEarningsAccount ?? "")
      : "";
  const { isDirty } = useDirtySnapshot(
    closeAccountId,
    `true:${closeTarget?.id ?? "new"}`,
    resetCloseAccountId,
  );

  if (!closeTarget) return null;

  const confirmCloseFiscalYear = async (): Promise<void> => {
    if (!closeAccountId) {
      setCloseError(t("accounting.settings.fy.closeAccountRequired"));
      return;
    }
    setClosing(true);
    setCloseError(null);
    try {
      const result = await closeFiscalYear.mutateAsync({
        id: closeTarget.id,
        retainedEarningsAccountId: closeAccountId,
      });
      notify.success(t("accounting.settings.fy.closed"));
      onClose();
      try {
        await onCloseSuccess(result.fiscalYear);
      } catch {
        // The close itself is persisted and the fiscal-year query was already
        // invalidated by the mutation, so a failed local mirror must not be
        // reported as a failed close.
      }
    } catch (error) {
      setCloseError(accountingErrorMessage(error) ?? t("accounting.settings.fy.closeFailed"));
    } finally {
      setClosing(false);
    }
  };

  const handleConfirmCloseFiscalYear = (): Promise<void | undefined> =>
    guardClose(() => confirmCloseFiscalYear());

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("accounting.settings.fy.closeConfirmTitle")}
      subtitle={closeTarget.label}
      icon={Lock}
      size="sm"
      error={closeError ?? undefined}
      cancelLabel={t("common.cancel")}
      saveLabel={t("accounting.settings.fy.close")}
      onSave={handleConfirmCloseFiscalYear}
      saving={closing}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      saveDisabled={!closeAccountId}
      formId="close-fiscal-year-form"
    >
      <form
        id="close-fiscal-year-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirmCloseFiscalYear();
        }}
        className="space-y-4"
      >
        <Alert
          role="alert"
          tone="destructive"
          description={t("accounting.settings.fy.closeIrreversible")}
        />
        <Field
          id="fy-close-retained-earnings"
          label={t("accounting.settings.fields.retainedEarningsAccount")}
          hint={t("accounting.settings.fy.closeAccountHint")}
          error={closeAccountId ? undefined : t("accounting.settings.fy.closeAccountRequired")}
        >
          <FormSelect
            id="fy-close-retained-earnings"
            name="retainedEarningsAccountId"
            value={closeAccountId}
            onChange={setCloseAccountId}
            placeholder={t("accounting.journal.form.none")}
            options={equityAccountOptions}
          />
        </Field>
      </form>
    </FormModal>
  );
}
