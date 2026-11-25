import type { InvoiceCreateInput, PaymentCreateInput } from "@mms/contracts";
import { notify } from "@mms/fe-core/notify";
import { NotifiedMutationError } from "@mms/fe-core/lib/notifiedMutationError";
import type { TranslationFunction } from "@mms/fe-core/i18n";

export interface UseFinanceFormActionsParams {
  createPayment: { mutateAsync: (payment: PaymentCreateInput) => Promise<unknown> };
  createInvoice: { mutateAsync: (invoice: InvoiceCreateInput) => Promise<unknown> };
  setRecordInvoice: (invoice: null) => void;
  setCreatingInvoice: (creating: boolean) => void;
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (subTab: string) => void;
  t: TranslationFunction;
}

export function useFinanceFormActions({
  createPayment,
  createInvoice,
  setRecordInvoice,
  setCreatingInvoice,
  setActiveTab,
  setActiveSubTab,
  t,
}: UseFinanceFormActionsParams) {
  const handleRecordPayment = async (paymentToRecord: PaymentCreateInput): Promise<void> => {
    try {
      await createPayment.mutateAsync(paymentToRecord);
      setRecordInvoice(null);
    } catch (error: unknown) {
      notify.error(t("finance.paymentSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw new NotifiedMutationError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCreateInvoice = async (invoiceToCreate: InvoiceCreateInput): Promise<void> => {
    try {
      await createInvoice.mutateAsync(invoiceToCreate);
      setCreatingInvoice(false);
      setActiveTab("work");
      setActiveSubTab("invoices");
    } catch (error: unknown) {
      notify.error(t("finance.invoiceSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw new NotifiedMutationError(error instanceof Error ? error.message : String(error));
    }
  };

  const openCreateInvoice = () => {
    setActiveTab("work");
    setActiveSubTab("invoices");
    setCreatingInvoice(true);
  };

  return {
    handleRecordPayment,
    handleCreateInvoice,
    openCreateInvoice,
  };
}
