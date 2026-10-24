import React, { useState } from "react";
import { ReceiptText } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notify } from "@/lib/notify";
import { PAYMENT_METHODS, type Invoice } from "@/lib/data/financeData";
import { SectionCard } from "@/components/app/SectionCard";
import { PaymentFormFields } from "@/tenant/features/finance/components/PaymentFormFields";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type PaymentCreateInput,
  paymentRecordInsertSchema,
  type AppTranslationKey,
} from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";
import {
  PAYMENT_METHOD_LABEL_KEYS,
  buildInitialPaymentDraft,
  buildPaymentCreatePayload,
  validatePaymentFormDraft,
} from "@/tenant/features/finance/lib/paymentFormHelpers";

export interface PaymentFormProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (payment: PaymentCreateInput) => void | Promise<void>;
}

export function PaymentForm({
  open,
  invoice,
  onClose,
  onSave,
}: PaymentFormProps): React.JSX.Element {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();
  const { formatCurrency, activeCurrency } = useFinanceCurrency();
  const balance = invoice ? invoice.finalAmt - (invoice.paidAmt || 0) : 0;

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentDraft, setPaymentDraft] = useState(() =>
    buildInitialPaymentDraft(balance, authUser?.id || ""),
  );

  const paymentMethodOptions = (() =>
    PAYMENT_METHODS.map((method) => ({
      value: method,
      label: t(PAYMENT_METHOD_LABEL_KEYS[method]),
    })))();

  const updateDraft = (patch: Partial<typeof paymentDraft>) => {
    setPaymentDraft((prev) => ({ ...prev, ...patch }));
    const patchedKeys = Object.keys(patch);
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of patchedKeys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const handleSave = async () => {
    setErrors({});
    const newErrors = validatePaymentFormDraft(paymentDraft, balance, t);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(t("finance.fixErrors"));
      return;
    }

    if (!invoice) return;

    const payload = buildPaymentCreatePayload(
      paymentDraft,
      invoice.id,
      invoice.studentId,
      invoice.studentName,
      authUser?.id || "",
    );

    const parsed = paymentRecordInsertSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors((prev) => ({
        ...prev,
        ...mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey)),
      }));
      notify.error(t("finance.fixErrors"));
      return;
    }

    setSaving(true);
    try {
      await onSave(payload);
      notify.success(t("finance.paymentSaved"));
      onClose();
    } catch (err: unknown) {
      if (!(err instanceof NotifiedMutationError)) {
        notify.error(t("finance.paymentSaveFailed"), {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const footerStart = invoice ? (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <span className="font-bold text-foreground bg-muted/65 px-2.5 py-1 rounded-lg border border-border/60">
        {invoice.studentName}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold border border-success/20 text-xs">
          {t("finance.balance", {
            balance: formatCurrency(balance - Number(paymentDraft.amount || 0)),
          })}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("finance.recordPayment")}
      icon={ReceiptText}
      cancelLabel={t("common.cancel")}
      saveLabel={t("finance.recordPayment")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={
        saving ||
        !invoice ||
        !paymentDraft.amount ||
        Number(paymentDraft.amount) <= 0 ||
        (balance > 0 && Number(paymentDraft.amount) > balance) ||
        !paymentDraft.date
      }
      error={Object.values(errors)[0]}
      footerStart={footerStart || undefined}
      formId="payment-form"
    >
      <form
        id="payment-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !saving &&
            invoice &&
            paymentDraft.amount &&
            Number(paymentDraft.amount) > 0 &&
            !(balance > 0 && Number(paymentDraft.amount) > balance) &&
            paymentDraft.date
          ) {
            void handleSave();
          }
        }}
        className="space-y-3 text-start"
      >
        {invoice && (
          <SectionCard accentColor="primary" padding="p-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-foreground m-0">
                  {invoice.studentName}
                </h4>
                <p className="truncate text-xs text-muted-foreground m-0 mt-0.5">
                  {invoice.id} · {invoice.class}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-xs uppercase font-bold text-muted-foreground">
                  {t("finance.balanceDue")}
                </p>
                <p className="text-sm font-bold text-primary m-0 mt-0.5">
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        <PaymentFormFields
          paymentDraft={paymentDraft}
          updateDraft={updateDraft}
          errors={errors}
          balance={balance}
          activeCurrencyCode={activeCurrency.code}
          formatCurrency={formatCurrency}
          paymentMethodOptions={paymentMethodOptions}
          t={t}
        />
      </form>
    </FormModal>
  );
}
