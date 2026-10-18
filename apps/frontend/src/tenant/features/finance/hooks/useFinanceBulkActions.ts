import type { InvoicesBulkStatusBody } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";

export interface UseFinanceBulkActionsOptions {
  bulkUpdateInvoiceStatus: {
    mutateAsync: (args: {
      ids: string[];
      status: InvoicesBulkStatusBody["status"];
    }) => Promise<{ succeeded: number; failed: number }>;
  };
  clearInvoiceSelection: () => void;
  clearPaymentSelection: () => void;
  t: TranslationFunction;
}

export function useFinanceBulkActions({
  bulkUpdateInvoiceStatus,
  clearInvoiceSelection,
  clearPaymentSelection,
  t,
}: UseFinanceBulkActionsOptions) {
  const mutationError = (error: Error): void => {
    notify.error(t("finance.trash.actionFailed"), { description: error.message });
  };

  const handleBulkResult = (
    result: { succeeded: number; failed: number },
    successKey: "finance.trash.deleted" | "finance.trash.restored",
    scope?: "invoices" | "payments",
  ): void => {
    if (result.failed > 0) {
      notify.error(
        t("finance.trash.bulkPartial", {
          succeeded: result.succeeded,
          failed: result.failed,
        }),
      );
    } else if (result.succeeded > 1) {
      notify.success(
        t(
          successKey === "finance.trash.deleted"
            ? "finance.trash.bulkDeleted"
            : "finance.trash.bulkRestored",
          { count: result.succeeded },
        ),
      );
    } else {
      notify.success(t(successKey));
    }
    if (scope === "invoices") {
      clearInvoiceSelection();
    } else if (scope === "payments") {
      clearPaymentSelection();
    } else {
      clearInvoiceSelection();
      clearPaymentSelection();
    }
  };

  const handleBulkStatusChange = async (ids: string[], status: string): Promise<void> => {
    try {
      const result = await bulkUpdateInvoiceStatus.mutateAsync({
        ids,
        status: status as InvoicesBulkStatusBody["status"],
      });
      if (result.failed > 0) {
        notify.error(t("finance.bulkStatusFailed"), {
          description: `${result.succeeded} updated, ${result.failed} failed`,
        });
      } else if (result.succeeded > 1) {
        notify.success(t("finance.bulkStatusSuccessMany", { count: result.succeeded }));
      } else {
        notify.success(t("finance.bulkStatusSuccess"));
      }
    } catch {
      notify.error(t("finance.bulkStatusFailed"));
    }
  };

  return {
    mutationError,
    handleBulkResult,
    handleBulkStatusChange,
  };
}
