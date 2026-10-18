import React from "react";
import { useFinancePageController } from "@/tenant/features/finance/hooks/useFinancePageController";
import { AnimatePresence } from "framer-motion";
import { DollarSign } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ErrorState } from "@/components/app/ErrorState";
import { InvoicesList } from "@/tenant/features/finance/components/InvoicesList";
import { PaymentsList } from "@/tenant/features/finance/components/PaymentsList";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { type Invoice } from "@/lib/data/financeData";
import { financeTransferSchema } from "@mms/shared";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { FinanceCommandMetrics } from "@/tenant/features/finance/components/FinanceCommandMetrics";
import { notify } from "@/lib/notify";
import { FinanceOverlays } from "@/tenant/features/finance/components/FinanceOverlays";
import { FinanceCsvImportDialog } from "@/tenant/features/finance/components/FinanceCsvImportDialog";
import { FinancePageHeaderActions } from "@/tenant/features/finance/components/FinancePageHeaderActions";

const FinanceSetupTier = React.lazy(() =>
  import("@/tenant/features/finance/components/FinanceSetupTier").then((m) => ({
    default: m.FinanceSetupTier,
  })),
);
const FinanceReportsTier = React.lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
);

/**
 * Finance — invoices and payments. Work | Reports | Setup.
 */
export default function Finance(): React.JSX.Element {
  const c = useFinancePageController();
  const [receiptInvoices, setReceiptInvoices] = React.useState<Invoice[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const { handleExport, isExporting } = useGenericModuleExport({
    path: "/api/finance/export/csv",
    filename: "finance-invoices.csv",
    auditPath: "/api/finance/export-audit",
    columns: financeTransferSchema.exportColumns,
    canExport: c.canWrite,
  });

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("nav.finance")}`}
      seoDescription={c.t("page.finance.subtitle")}
      headerIcon={DollarSign}
      headerTitle={c.t("nav.finance")}
      headerSubtitle={c.t("page.finance.subtitle")}
      headerActions={
        <FinancePageHeaderActions
          canWrite={c.canWrite}
          canExport={c.canWrite}
          showDeleted={c.showDeleted}
          isExporting={isExporting}
          collectPending={c.collectPending}
          remindPending={c.remindPending}
          onCollectOverdue={() => void c.handleCollectOverdue()}
          onRemindInvoices={() => void c.handleRemindInvoices()}
          onGenerateInvoices={() => c.setGeneratingInvoices(true)}
          onCreateInvoice={c.openCreateInvoice}
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
        />
      }
      metricsStrip={<FinanceCommandMetrics invoiceTotal={c.invoices.length} />}
    >
      <ResponsiveAccordionTabs
        tabs={c.PAGE_TABS}
        activeTab={c.activeTab}
        onTabChange={c.setActiveTab}
        panelIdPrefix="finance-tab"
      >
        {c.activeTab === "work" && (
          <>
            <SubTabBar
              tabs={c.SUB_TABS.map((tab) => ({ key: tab.id, label: tab.label }))}
              value={c.activeSubTab}
              onChange={c.setActiveSubTab}
            />
          </>
        )}

        <AnimatePresence mode="wait">
          <ModuleTierMotion tier={c.activeTab + "-" + c.activeSubTab} className="space-y-4">
            <ErrorBoundary>
              {c.activeTab === "reports" && (
                <React.Suspense fallback={<RouteStatusFallback />}>
                  <FinanceReportsTier category="finance" />
                </React.Suspense>
              )}
              {c.activeTab === "setup" && (
                <React.Suspense fallback={<RouteStatusFallback />}>
                  <FinanceSetupTier />
                </React.Suspense>
              )}

              {c.activeTab === "work" &&
              c.activeSubTab === "invoices" &&
              c.invoicesResult.isError ? (
                <ErrorState
                  title={c.t("finance.loadFailed")}
                  description={c.t("finance.loadFailedHint")}
                  onRetry={() => void c.invoicesResult.refetch()}
                />
              ) : (
                c.activeTab === "work" &&
                c.activeSubTab === "invoices" && (
                  <InvoicesList
                    invoices={c.invoices}
                    {...c.invoiceStatusFilter}
                    onView={c.setViewInvoice}
                    onRecord={c.setRecordInvoice}
                    canWrite={c.canWrite}
                    canDelete={c.canDelete}
                    canWriteMessaging={c.canWriteMessaging}
                    showDeleted={c.showDeleted}
                    onToggleDeleted={() => c.setShowDeleted((value) => !value)}
                    onDelete={(id) =>
                      c.deleteInvoice.mutate(id, {
                        onSuccess: () => notify.success(c.t("finance.trash.deleted")),
                        onError: c.mutationError,
                      })
                    }
                    onRestore={(id) =>
                      c.restoreInvoice.mutate(id, {
                        onSuccess: () => notify.success(c.t("finance.trash.restored")),
                        onError: c.mutationError,
                      })
                    }
                    onBulkDelete={(ids) =>
                      c.bulkDeleteInvoices.mutate(ids, {
                        onSuccess: (result: unknown) =>
                          c.handleBulkResult(
                            result as { succeeded: number; failed: number },
                            "finance.trash.deleted",
                            "invoices",
                          ),
                        onError: c.mutationError,
                      })
                    }
                    onBulkRestore={(ids) =>
                      c.bulkRestoreInvoices.mutate(ids, {
                        onSuccess: (result: unknown) =>
                          c.handleBulkResult(
                            result as { succeeded: number; failed: number },
                            "finance.trash.restored",
                            "invoices",
                          ),
                        onError: c.mutationError,
                      })
                    }
                    onBulkStatusChange={(ids, status) => void c.handleBulkStatusChange(ids, status)}
                    onBulkPrintReceipts={(inv) => setReceiptInvoices(inv)}
                    isBulkStatusPending={c.bulkUpdateInvoiceStatus.isPending}
                    selectedIds={c.invoiceSelection.selectedIds}
                    onToggleSelectedInvoice={c.invoiceSelection.toggleSelected}
                    onToggleSelectAll={c.invoiceSelection.toggleSelectAll}
                    onClearSelection={c.invoiceSelection.clearSelection}
                    isColumnVisible={c.invoiceColumnLayout.isColumnVisible}
                    getColumnWidth={c.invoiceColumnLayout.getColumnWidth}
                    onColumnResize={c.invoiceColumnLayout.setColumnWidth}
                    columnCustomizer={{
                      columnRegistry: c.invoiceColumnLayout.columnRegistry,
                      updateUserColumnLayout: c.invoiceColumnLayout.updateUserColumnLayout,
                      onResetLayout: c.invoiceColumnLayout.resetColumnLayout,
                      labels: c.invoiceColumnLayout.customizerLabels,
                    }}
                  />
                )
              )}
              {c.activeTab === "work" &&
              c.activeSubTab === "payments" &&
              c.paymentsResult.isError ? (
                <ErrorState
                  title={c.t("finance.loadFailed")}
                  description={c.t("finance.loadFailedHint")}
                  onRetry={() => void c.paymentsResult.refetch()}
                />
              ) : (
                c.activeTab === "work" &&
                c.activeSubTab === "payments" && (
                  <PaymentsList
                    payments={c.payments}
                    canDelete={c.canDelete}
                    showDeleted={c.showDeleted}
                    onDelete={(id) =>
                      c.deletePayment.mutate(id, {
                        onSuccess: () => notify.success(c.t("finance.trash.deleted")),
                        onError: c.mutationError,
                      })
                    }
                    onRestore={(id) =>
                      c.restorePayment.mutate(id, {
                        onSuccess: () => notify.success(c.t("finance.trash.restored")),
                        onError: c.mutationError,
                      })
                    }
                    onBulkDelete={(ids) =>
                      c.bulkDeletePayments.mutate(ids, {
                        onSuccess: (result: unknown) =>
                          c.handleBulkResult(
                            result as { succeeded: number; failed: number },
                            "finance.trash.deleted",
                            "payments",
                          ),
                        onError: c.mutationError,
                      })
                    }
                    onBulkRestore={(ids) =>
                      c.bulkRestorePayments.mutate(ids, {
                        onSuccess: (result: unknown) =>
                          c.handleBulkResult(
                            result as { succeeded: number; failed: number },
                            "finance.trash.restored",
                            "payments",
                          ),
                        onError: c.mutationError,
                      })
                    }
                    selectedIds={c.paymentSelection.selectedIds}
                    onTogglePayment={c.paymentSelection.toggleSelected}
                    onToggleSelectAll={c.paymentSelection.toggleSelectAll}
                    onClearSelection={c.paymentSelection.clearSelection}
                    isColumnVisible={c.paymentColumnLayout.isColumnVisible}
                    getColumnWidth={c.paymentColumnLayout.getColumnWidth}
                    onColumnResize={c.paymentColumnLayout.setColumnWidth}
                    columnCustomizer={{
                      columnRegistry: c.paymentColumnLayout.columnRegistry,
                      updateUserColumnLayout: c.paymentColumnLayout.updateUserColumnLayout,
                      onResetLayout: c.paymentColumnLayout.resetColumnLayout,
                      labels: c.paymentColumnLayout.customizerLabels,
                    }}
                    onRowClick={(id: string) => {
                      const p = c.payments.find((x) => x.id === id);
                      if (p) c.setActivePayment(p);
                    }}
                  />
                )
              )}
            </ErrorBoundary>
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <FinanceOverlays
        c={c}
        receiptInvoices={receiptInvoices}
        onCloseReceipts={() => setReceiptInvoices([])}
        onSetReceiptInvoices={setReceiptInvoices}
      />

      <FinanceCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={c.canWrite}
      />
    </ModulePageShell>
  );
}
