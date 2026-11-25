import React, { lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import type { Invoice } from "../lib/financeData";
import type { useFinancePageController } from "../hooks/useFinancePageController";

const InvoiceDetail = lazy(() =>
  import("./InvoiceDetail").then((m) => ({
    default: m.InvoiceDetail,
  })),
);
const InvoiceForm = lazy(() =>
  import("./InvoiceForm").then((m) => ({
    default: m.InvoiceForm,
  })),
);
const FinanceGenerateInvoicesDialog = lazy(() =>
  import("./FinanceGenerateInvoicesDialog").then((m) => ({
    default: m.FinanceGenerateInvoicesDialog,
  })),
);
const PaymentForm = lazy(() =>
  import("./PaymentForm").then((m) => ({
    default: m.PaymentForm,
  })),
);
const PaymentDetail = lazy(() =>
  import("./PaymentDetail").then((m) => ({
    default: m.PaymentDetail,
  })),
);
const InvoiceReceiptModal = lazy(() =>
  import("./InvoiceReceiptModal").then((m) => ({
    default: m.InvoiceReceiptModal,
  })),
);
const MessageComposer = lazy(() => import("../host/TenantMessageComposer.js"));

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
      <Suspense fallback={null}>
        <AnimatePresence>
          {c.generatingInvoices && c.canWrite && !c.showDeleted && (
            <FinanceGenerateInvoicesDialog
              open={c.generatingInvoices}
              onClose={() => c.setGeneratingInvoices(false)}
            />
          )}
          {c.creatingInvoice && c.canWrite && !c.showDeleted && (
            <InvoiceForm
              open={c.creatingInvoice}
              saving={c.createInvoice.isPending}
              onClose={() => c.setCreatingInvoice(false)}
              onSave={c.handleCreateInvoice}
            />
          )}
          {c.viewInvoice && (
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
          )}
          {c.recordInvoice && c.canWrite && !c.showDeleted && (
            <PaymentForm
              open={Boolean(c.recordInvoice)}
              invoice={c.recordInvoice}
              onClose={() => c.setRecordInvoice(null)}
              onSave={c.handleRecordPayment}
            />
          )}
        </AnimatePresence>
      </Suspense>

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

      <Suspense fallback={null}>
        <AnimatePresence>
          {c.activePayment && (
            <PaymentDetail
              payment={c.activePayment}
              onClose={() => c.setActivePayment(null)}
              canDelete={c.canDelete}
              onRestore={c.restorePayment.mutateAsync}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
