import { translateApiMessage } from "@mms/fe-core/forms/translateValidationMessage";
import React, { useState } from "react";
import { Ban, StickyNote } from "lucide-react";
import { Button } from "@mms/ui";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FORM_INPUT } from "@mms/ui";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { tryParseMoneyAmountNumber } from "@mms/contracts";
import { notify } from "@mms/fe-core/notify";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import { useSubmitGuard } from "@mms/fe-core/forms/useSubmitGuard";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import {
  canCancelInvoice,
  canCreditInvoice,
  FINANCE_MODULE_MANIFEST,
  getOutstandingAmountForInvoice,
  type Invoice,
} from "@mms/contracts";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import {
  useFinanceCollectMutations,
  useFinanceCreditNotes,
} from "@/tenant/features/finance/hooks/useFinanceCollect";

export function InvoiceCorrectionActions({
  invoice,
  onCancelled,
}: {
  invoice: Invoice;
  onCancelled?: () => void;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  const { can } = usePermissions();
  // Cancelling and credit notes are money-affecting decisions (the fee-waiver
  // path); recording a payment is not enough authority to undo one.
  const canManage = can(FINANCE_MODULE_MANIFEST.permissions.manage);
  const { cancel, credit } = useFinanceCollectMutations();
  const { data: notes = [] } = useFinanceCreditNotes(invoice.id);
  const [creditOpen, setCreditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Both actions move money; a same-frame double click must not post twice.
  const guardCredit = useSubmitGuard();
  const guardCancel = useSubmitGuard();
  // Reopening the credit action (or switching invoice) must start from a blank
  // amount/reason instead of the previous submission's values.
  useIdentityReset(`${invoice.id}:${creditOpen ? "open" : "closed"}`, () => {
    setAmount("");
    setReason("");
    setFormError(null);
  });
  // The credit modal's identity is the invoice plus its open state; the reset above
  // blanks both fields, so that is the baseline.
  const { isDirty } = useDirtySnapshot({ amount, reason }, `${creditOpen}:${invoice.id}`, {
    amount: "",
    reason: "",
  });
  const openBalance = getOutstandingAmountForInvoice(invoice);
  const creditAmt = tryParseMoneyAmountNumber(amount) ?? 0;
  const showCredit = canManage && openBalance > 0 && canCreditInvoice(invoice, openBalance);
  const showCancel = canManage && canCancelInvoice(invoice);

  if (invoice.status === "cancelled" || (!showCredit && !showCancel && notes.length === 0))
    return null;

  // Returns `false` on failure so ConfirmAlertDialog keeps the dialog open instead
  // of closing before the ledger mutation resolves.
  const handleCancel = async (): Promise<boolean> => {
    const result = await guardCancel(async () => {
      try {
        await cancel.mutateAsync(invoice.id);
        notify.success(t("finance.collect.cancelled"));
        onCancelled?.();
        return true;
      } catch (error) {
        notify.error(t("finance.collect.cancelFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    });
    return result ?? false;
  };

  const handleCredit = async (): Promise<void> => {
    await guardCredit(async () => {
      if (!canCreditInvoice(invoice, creditAmt)) return;
      try {
        await credit.mutateAsync({
          invoiceId: invoice.id,
          amount: creditAmt,
          reason: reason.trim(),
        });
        notify.success(t("finance.collect.creditSaved"));
        setCreditOpen(false);
        setAmount("");
        setReason("");
        setFormError(null);
      } catch (error) {
        const mapped = mapApiFormError(error, (message) => translateApiMessage(message, t));
        setFormError(mapped.message ?? t("finance.collect.creditFailed"));
        if (!mapped.fieldErrors) {
          notify.error(t("finance.collect.creditFailed"), {
            description: mapped.message ?? (error instanceof Error ? error.message : String(error)),
          });
        }
      }
    });
  };

  return (
    <div className="space-y-2">
      {notes.length > 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          {t("finance.collect.creditsPosted", { count: notes.length })}
        </p>
      )}
      {showCredit && (
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => setCreditOpen(true)}
        >
          <StickyNote className="me-1 h-4 w-4" aria-hidden="true" />
          {t("finance.collect.creditAction")}
        </Button>
      )}
      {showCancel && (
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11 text-destructive"
          onClick={() => setCancelOpen(true)}
          disabled={cancel.isPending}
        >
          <Ban className="me-1 h-4 w-4" aria-hidden="true" />
          {t("finance.collect.cancelAction")}
        </Button>
      )}
      <FormModal
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        title={t("finance.collect.creditTitle")}
        subtitle={t("finance.collect.creditHint")}
        icon={StickyNote}
        cancelLabel={t("common.cancel")}
        saveLabel={t("finance.collect.creditSubmit")}
        onSave={handleCredit}
        saving={credit.isPending}
        isDirty={isDirty}
        discardUnsavedTitle={t("settings.unsavedChanges")}
        discardUnsavedDescription={t("common.discardUnsavedDescription")}
        error={formError ?? undefined}
        saveDisabled={!canCreditInvoice(invoice, creditAmt)}
        formId="invoice-credit-form"
      >
        <form
          id="invoice-credit-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreditInvoice(invoice, creditAmt) && !credit.isPending) {
              void handleCredit();
            }
          }}
          className="space-y-3"
        >
          <Field id="credit-amount" label={t("finance.collect.creditAmount")}>
            <Input
              id="credit-amount"
              className={FORM_INPUT}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field id="credit-reason" label={t("finance.collect.creditReason")}>
            <Input
              id="credit-reason"
              className={FORM_INPUT}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </form>
      </FormModal>
      <ConfirmAlertDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("finance.collect.cancelAction")}
        description={t("finance.collect.cancelConfirm")}
        confirmLabel={t("finance.collect.cancelAction")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => handleCancel()}
      />
    </div>
  );
}
