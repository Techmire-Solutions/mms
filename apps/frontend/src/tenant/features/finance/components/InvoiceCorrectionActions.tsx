import React, { useState } from "react";
import { Ban, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { FormModal } from "@/components/ui/FormModal";
import { Field } from "@/components/ui/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  canCancelInvoice,
  canCreditInvoice,
  getOutstandingAmountForInvoice,
  type Invoice,
} from "@mms/shared";
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
  const { cancel, credit } = useFinanceCollectMutations();
  const { data: notes = [] } = useFinanceCreditNotes(invoice.id);
  const [creditOpen, setCreditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const openBalance = getOutstandingAmountForInvoice(invoice);
  const creditAmt = Number(amount);
  const showCredit = openBalance > 0 && canCreditInvoice(invoice, openBalance);
  const showCancel = canCancelInvoice(invoice);

  if (invoice.status === "cancelled" || (!showCredit && !showCancel && notes.length === 0))
    return null;

  const handleCancel = async (): Promise<void> => {
    try {
      await cancel.mutateAsync(invoice.id);
      notify.success(t("finance.collect.cancelled"));
      onCancelled?.();
    } catch (error) {
      notify.error(t("finance.collect.cancelFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCredit = async (): Promise<void> => {
    if (!canCreditInvoice(invoice, creditAmt)) return;
    try {
      await credit.mutateAsync({ invoiceId: invoice.id, amount: creditAmt, reason: reason.trim() });
      notify.success(t("finance.collect.creditSaved"));
      setCreditOpen(false);
      setAmount("");
      setReason("");
    } catch (error) {
      notify.error(t("finance.collect.creditFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
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
        onSave={() => void handleCredit()}
        saving={credit.isPending}
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
        onConfirm={() => {
          setCancelOpen(false);
          void handleCancel();
        }}
      />
    </div>
  );
}
