import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type {
  Invoice,
  InvoiceCreateInput,
  InvoicesBulkStatusBody,
  Payment,
  PaymentCreateInput,
} from "@mms/shared";
import {
  useFinanceContractCreateInvoice,
  useFinanceContractUpdateInvoice,
  useFinanceContractDeleteInvoice,
  useFinanceContractCreatePayment,
  useFinanceContractUpdatePayment,
  useFinanceContractDeletePayment,
  useFinanceContractBulkDeleteInvoices,
  useFinanceContractBulkStatusInvoices,
  useFinanceContractRestoreInvoice,
  useFinanceContractRestorePayment,
  useFinanceContractBulkRestoreInvoices,
  useFinanceContractBulkRestorePayments,
  useFinanceContractBulkDeletePayments,
} from "@/tenant/features/finance/hooks/useFinanceTsrHooks";

export function useFinanceMutations() {
  const _queryClient = useQueryClient();

  const createInvoice = useFinanceContractCreateInvoice();
  const updateInvoice = useFinanceContractUpdateInvoice();
  const deleteInvoice = useFinanceContractDeleteInvoice();
  const restoreInvoice = useFinanceContractRestoreInvoice();

  const bulkDeleteInvoices = useFinanceContractBulkDeleteInvoices();
  const bulkRestoreInvoices = useFinanceContractBulkRestoreInvoices();
  const bulkUpdateInvoiceStatus = useFinanceContractBulkStatusInvoices();

  const createPayment = useFinanceContractCreatePayment();
  const updatePayment = useFinanceContractUpdatePayment();
  const deletePayment = useFinanceContractDeletePayment();
  const restorePayment = useFinanceContractRestorePayment();

  const bulkDeletePayments = useFinanceContractBulkDeletePayments();
  const bulkRestorePayments = useFinanceContractBulkRestorePayments();

  return {
    createInvoice: {
      ...createInvoice,
      mutate: (invoice: InvoiceCreateInput, opts?: MutateOptions) =>
        createInvoice.mutate({ body: invoice }, opts),
      mutateAsync: (invoice: InvoiceCreateInput) => createInvoice.mutateAsync({ body: invoice }),
    },
    updateInvoice: {
      ...updateInvoice,
      mutate: ({ id, invoice }: { id: string; invoice: Invoice }, opts?: MutateOptions) =>
        updateInvoice.mutate({ params: { id }, body: invoice }, opts),
      mutateAsync: ({ id, invoice }: { id: string; invoice: Invoice }) =>
        updateInvoice.mutateAsync({ params: { id }, body: invoice }),
    },
    deleteInvoice: {
      ...deleteInvoice,
      mutate: (id: string, opts?: MutateOptions) => deleteInvoice.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => deleteInvoice.mutateAsync({ params: { id } }),
    },
    restoreInvoice: restoreInvoice
      ? {
          ...restoreInvoice,
          mutate: (id: string, opts?: MutateOptions) =>
            restoreInvoice.mutate({ params: { id } }, opts),
          mutateAsync: (id: string) => restoreInvoice.mutateAsync({ params: { id } }),
        }
      : null,
    bulkDeleteInvoices: {
      ...bulkDeleteInvoices,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteInvoices.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteInvoices.mutateAsync({ body: { ids } }),
    },
    bulkRestoreInvoices: bulkRestoreInvoices
      ? {
          ...bulkRestoreInvoices,
          mutate: (ids: string[], opts?: MutateOptions) =>
            bulkRestoreInvoices.mutate({ body: { ids } }, opts),
          mutateAsync: (ids: string[]) => bulkRestoreInvoices.mutateAsync({ body: { ids } }),
        }
      : null,
    bulkUpdateInvoiceStatus: {
      ...bulkUpdateInvoiceStatus,
      mutate: (body: InvoicesBulkStatusBody, opts?: MutateOptions) =>
        bulkUpdateInvoiceStatus.mutate({ body }, opts),
      mutateAsync: (body: InvoicesBulkStatusBody) => bulkUpdateInvoiceStatus.mutateAsync({ body }),
    },
    createPayment: {
      ...createPayment,
      mutate: (payment: PaymentCreateInput, opts?: MutateOptions) =>
        createPayment.mutate({ body: payment }, opts),
      mutateAsync: (payment: PaymentCreateInput) => createPayment.mutateAsync({ body: payment }),
    },
    updatePayment: {
      ...updatePayment,
      mutate: ({ id, payment }: { id: string; payment: Payment }, opts?: MutateOptions) =>
        updatePayment.mutate({ params: { id }, body: payment }, opts),
      mutateAsync: ({ id, payment }: { id: string; payment: Payment }) =>
        updatePayment.mutateAsync({ params: { id }, body: payment }),
    },
    deletePayment: {
      ...deletePayment,
      mutate: (id: string, opts?: MutateOptions) => deletePayment.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => deletePayment.mutateAsync({ params: { id } }),
    },
    restorePayment: restorePayment
      ? {
          ...restorePayment,
          mutate: (id: string, opts?: MutateOptions) =>
            restorePayment.mutate({ params: { id } }, opts),
          mutateAsync: (id: string) => restorePayment.mutateAsync({ params: { id } }),
        }
      : null,
    bulkDeletePayments: {
      ...bulkDeletePayments,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeletePayments.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeletePayments.mutateAsync({ body: { ids } }),
    },
    bulkRestorePayments: bulkRestorePayments
      ? {
          ...bulkRestorePayments,
          mutate: (ids: string[], opts?: MutateOptions) =>
            bulkRestorePayments.mutate({ body: { ids } }, opts),
          mutateAsync: (ids: string[]) => bulkRestorePayments.mutateAsync({ body: { ids } }),
        }
      : null,
  };
}
