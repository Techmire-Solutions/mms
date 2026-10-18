import React, { lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import type { Invoice } from "@/lib/data/financeData";
import type { useFinancePageController } from "@/tenant/features/finance/hooks/useFinancePageController";

const InvoiceDetail = lazy(() =>
  import("@/tenant/features/finance/components/InvoiceDetail").then((m) => ({
    default: m.InvoiceDetail,
  })),
);
const InvoiceForm = lazy(() =>
  import("@/tenant/features/finance/components/InvoiceForm").then((m) => ({
    default: m.InvoiceForm,
  })),
);
const FinanceGenerateInvoicesDialog = lazy(() =>
  import("@/tenant/features/finance/components/FinanceGenerateInvoicesDialog").then((m) => ({
    default: m.FinanceGenerateInvoicesDialog,
  })),
);
const PaymentForm = lazy(() =>
  import("@/tenant/features/finance/components/PaymentForm").then((m) => ({
    default: m.PaymentForm,
  })),
);
const PaymentDetail = lazy(() =>
  import("@/tenant/features/finance/components/PaymentDetail").then((m) => ({
    default: m.PaymentDetail,
  })),
);
const InvoiceReceiptModal = lazy(() =>
  import("@/tenant/features/finance/components/InvoiceReceiptModal").then((m) => ({
    default: m.InvoiceReceiptModal,
  })),
);
const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));

export interface FinanceOverlaysProps {
  c: ReturnType<typeof useFinancePageController>;
  receiptInvoices: Invoice[];
  onCloseReceipts: () => void;
  onSetReceiptInvoices: (invoices: Invoice[]) => void;
}

export function FinanceOverlays({
  c,
  receiptInvoices,
  onCloseReceipts,
  onSetReceiptInvoices,
}: FinanceOverlaysProps): React.JSX.Element {
  return (
    <>
      <AnimatePresence>
        {c.generatingInvoices && c.canWrite && !c.showDeleted && (
          <Suspense fallback={null}>
            <FinanceGenerateInvoicesDialog
              open={c.generatingInvoices}
              onClose={() => c.setGeneratingInvoices(false)}
            />
          </Suspense>
        )}
        {c.creatingInvoice && c.canWrite && !c.showDeleted && (
          <Suspense fallback={null}>
            <InvoiceForm
              open={c.creatingInvoice}
              saving={c.createInvoice.isPending}
              onClose={() => c.setCreatingInvoice(false)}
              onSave={c.handleCreateInvoice}
            />
          </Suspense>
        )}
        {c.viewInvoice && (
          <Suspense fallback={null}>
            <InvoiceDetail
              invoice={c.viewInvoice}
              onClose={() => c.setViewInvoice(null)}
              onRecord={(invoiceToRecord: Invoice) => {
                c.setViewInvoice(null);
                c.setRecordInvoice(invoiceToRecord);
              }}
              onPrintReceipt={(inv) => {
                c.setViewInvoice(null);
                onSetReceiptInvoices([inv]);
              }}
              canWrite={c.canWrite}
              canDelete={c.canDelete}
              onRestore={c.restoreInvoice.mutateAsync}
            />
          </Suspense>
        )}
        {c.recordInvoice && c.canWrite && !c.showDeleted && (
          <Suspense fallback={null}>
            <PaymentForm
              open={Boolean(c.recordInvoice)}
              invoice={c.recordInvoice}
              onClose={() => c.setRecordInvoice(null)}
              onSave={c.handleRecordPayment}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {receiptInvoices.length > 0 && (
        <Suspense fallback={null}>
          <InvoiceReceiptModal invoices={receiptInvoices} onClose={onCloseReceipts} />
        </Suspense>
      )}

      {c.messagingTarget && (
        <Suspense fallback={null}>
          <MessageComposer
            channel={c.messagingTarget.channel}
            recipients={c.messagingTarget.recipients}
            initialMessage={c.messagingTarget.initialMessage}
            onClose={c.closeComposer}
          />
        </Suspense>
      )}

      <AnimatePresence>
        {c.activePayment && (
          <Suspense fallback={null}>
            <PaymentDetail
              payment={c.activePayment}
              onClose={() => c.setActivePayment(null)}
              canDelete={c.canDelete}
              onRestore={c.restorePayment.mutateAsync}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}
