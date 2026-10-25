import React, { useMemo, useState, useEffect } from "react";
import type { Account, FiscalYear } from "@mms/shared";
import { Lock } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { Alert } from "@/components/app/Alert";
import { useCloseFiscalYear } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { accountingErrorMessage } from "@/tenant/features/accounting/hooks/useAccountingSetupSaveActions";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

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
  const [closeAccountId, setCloseAccountId] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const equityAccountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.type === "Equity" && account.isActive !== false)
        .sort((firstAccount, secondAccount) => firstAccount.code.localeCompare(secondAccount.code))
        .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` })),
    [accounts],
  );

  useEffect(() => {
    if (closeTarget) {
      const preferred = preferredRetainedEarningsAccount;
      setCloseAccountId(
        equityAccountOptions.some((option) => option.value === preferred) ? (preferred ?? "") : "",
      );
      setCloseError(null);
    }
  }, [closeTarget, preferredRetainedEarningsAccount, equityAccountOptions]);

  if (!closeTarget) return null;

  const handleConfirmCloseFiscalYear = async (): Promise<void> => {
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
