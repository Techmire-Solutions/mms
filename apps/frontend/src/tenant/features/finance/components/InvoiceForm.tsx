import React, { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import {
  invoiceTotalsFromLines,
  invoiceRecordInsertSchema,
  type InvoiceCreateInput,
  type AppTranslationKey,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useFinanceConfig } from "@/hooks/useStandardModuleConfig";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { InvoiceFormFieldsSection } from "@/tenant/features/finance/components/InvoiceFormFieldsSection";
import { InvoiceFormSummarySection } from "@/tenant/features/finance/components/InvoiceFormSummarySection";
import {
  buildInvoiceCreatePayload,
  canSaveInvoiceDraft,
  computeInvoiceAmounts,
  createInitialDraft,
  nextInvoiceId,
  type InvoiceDraft,
} from "@/tenant/features/finance/components/invoiceFormDraft";
import { useFinanceFeeStructures } from "@/tenant/features/finance/hooks/useFinanceFeeStructures";

export interface InvoiceFormProps {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (invoice: InvoiceCreateInput) => void | Promise<void>;
}

export const InvoiceForm = function InvoiceForm({
  open,
  saving = false,
  onClose,
  onSave,
}: InvoiceFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const { settings } = useFinanceConfig();
  const { formatCurrency } = useFinanceCurrency();
  const { data: feeStructures = [] } = useFinanceFeeStructures(open);

  const [draft, setDraft] = useState<InvoiceDraft>(() => createInitialDraft(settings.dueDays));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setDraft(createInitialDraft(settings.dueDays));
      setErrors({});
      setSubmitError(undefined);
    }
  }, [open, settings.dueDays]);

  const { baseFee, discountValue, discountAmt, finalAmt } = computeInvoiceAmounts(
    draft.baseFee,
    draft.discountValue,
  );
  const canSave = (() => canSaveInvoiceDraft(draft, baseFee))();

  const setField = (key: keyof InvoiceDraft, value: string): void => {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitError(undefined);
  };

  const applyFeeStructure = (structureId: string): void => {
    const structure = feeStructures.find((item) => item.id === structureId);
    const totals = structure
      ? invoiceTotalsFromLines(
          structure.items.map((item) => ({
            quantity: 1,
            amount: item.amount,
            discountAmt: 0,
          })),
        )
      : null;
    setDraft((currentDraft) => ({
      ...currentDraft,
      feeStructureId: structureId,
      class: structure?.className || currentDraft.class,
      session: structure?.session || currentDraft.session,
      baseFee: totals ? String(totals.baseFee) : currentDraft.baseFee,
    }));
    setErrors((prev) => {
      if (!prev.baseFee && !prev.class && !prev.session) return prev;
      const next = { ...prev };
      delete next.baseFee;
      delete next.class;
      delete next.session;
      return next;
    });
  };

  const resetAndClose = (): void => {
    setDraft(createInitialDraft(settings.dueDays));
    setErrors({});
    setSubmitError(undefined);
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const newErrors: Record<string, string> = {};
    if (!draft.studentName.trim()) newErrors.studentName = t("common.required");
    if (!draft.studentId.trim()) newErrors.studentId = t("common.required");
    if (!draft.class.trim()) newErrors.class = t("common.required");
    if (!draft.session.trim()) newErrors.session = t("common.required");
    if (!draft.baseFee.trim() || baseFee <= 0) newErrors.baseFee = t("finance.amountRequired");
    if (!draft.dueDate.trim()) newErrors.dueDate = t("finance.dateRequired");

    if (Object.keys(newErrors).length > 0 || !canSave) {
      setErrors(newErrors);
      setSubmitError(t("finance.fixErrors"));
      return;
    }

    const payload = buildInvoiceCreatePayload(
      draft,
      baseFee,
      discountValue,
      discountAmt,
      finalAmt,
      nextInvoiceId(settings),
      feeStructures,
    );

    const parsed = invoiceRecordInsertSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors((prev) => ({
        ...prev,
        ...mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey)),
      }));
      setSubmitError(t("finance.fixErrors"));
      return;
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      notify.success(t("finance.invoiceSaved"));
      resetAndClose();
    } catch (error: unknown) {
      if (!(error instanceof NotifiedMutationError)) {
        notify.error(t("finance.invoiceSaveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={resetAndClose}
      title={t("finance.newInvoice")}
      subtitle={t("finance.form.subtitle")}
      icon={ReceiptText}
      cancelLabel={t("common.cancel")}
      saveLabel={t("finance.form.create")}
      onSave={handleSubmit}
      saving={saving || submitting}
      saveDisabled={!canSave}
      error={submitError}
      formId="invoice-form"
    >
      <form
        id="invoice-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave && !saving && !submitting) void handleSubmit();
        }}
        className="space-y-3 text-start"
      >
        <InvoiceFormFieldsSection
          t={t}
          draft={draft}
          onFieldChange={setField}
          feeStructures={feeStructures}
          onApplyFeeStructure={applyFeeStructure}
          errors={errors}
        />
        <InvoiceFormSummarySection
          t={t}
          baseFee={baseFee}
          discountAmt={discountAmt}
          finalAmt={finalAmt}
          formatCurrency={formatCurrency}
        />
      </form>
    </FormModal>
  );
};
