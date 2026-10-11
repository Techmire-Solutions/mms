import { useEffect, useState } from "react";
import { ReceiptText, CreditCard } from "lucide-react";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { FINANCE_MODULE_MANIFEST, type Payment } from "@mms/shared";
import {
  useFinanceInvoicesPaginated,
  useFinancePaymentsPaginated,
  useFinanceMutations,
} from "@/tenant/features/finance/hooks/useFinanceApi";
import { useFinanceInvoiceColumnLayout } from "@/tenant/features/finance/hooks/useFinanceInvoiceColumnLayout";
import { useFinancePaymentColumnLayout } from "@/tenant/features/finance/hooks/useFinancePaymentColumnLayout";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useFinanceCollectActions } from "./useFinanceCollectActions";
import { useFinanceBulkActions } from "./useFinanceBulkActions";
import { useFinanceModalState } from "./useFinanceModalState";
import { useFinanceFormActions } from "./useFinanceFormActions";
import { useFinanceInvoiceStatusFilter } from "./useFinanceInvoiceStatusFilter";

export function useFinancePageController() {
  const { t } = useTranslation();
  const {
    canWrite,
    canDelete,
    canReports: canViewReports,
    canViewSetup,
  } = useModulePermissions(FINANCE_MODULE_MANIFEST);
  const PAGE_TABS = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.finance",
  });
  const SUB_TABS = [
    { id: "invoices", label: t("finance.invoices"), icon: ReceiptText },
    { id: "payments", label: t("finance.payments"), icon: CreditCard },
  ];
  const [activeTab, setActiveTab] = usePersistedTabState<string>("finance_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = useState("invoices");
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const invoiceStatusFilter = useFinanceInvoiceStatusFilter({
    setActiveTab,
    setActiveSubTab,
    setShowDeleted,
  });
  const invoicesResult = useFinanceInvoicesPaginated({
    includeDeleted: showDeleted,
    page: 1,
    limit: 100,
  });
  const paymentsResult = useFinancePaymentsPaginated({
    includeDeleted: showDeleted,
    page: 1,
    limit: 100,
  });
  const invoices = invoicesResult.data?.invoices ?? [];
  const payments = paymentsResult.data?.payments ?? [];
  const {
    createInvoice,
    createPayment,
    deleteInvoice,
    restoreInvoice,
    bulkDeleteInvoices,
    bulkRestoreInvoices,
    bulkUpdateInvoiceStatus,
    deletePayment,
    restorePayment,
    bulkDeletePayments,
    bulkRestorePayments,
  } = useFinanceMutations();
  const { canWriteMessaging, messagingTarget, openComposer, closeComposer } =
    useMessageComposerState();
  const modalState = useFinanceModalState();

  const invoiceColumnLayout = useFinanceInvoiceColumnLayout();
  const paymentColumnLayout = useFinancePaymentColumnLayout();

  const invoiceSelection = useWorkSelection<string>();
  const paymentSelection = useWorkSelection<string>();

  const { clearSelection: clearInvoiceSelection } = invoiceSelection;
  const { clearSelection: clearPaymentSelection } = paymentSelection;
  useEffect(() => {
    clearInvoiceSelection();
    clearPaymentSelection();
  }, [activeSubTab, showDeleted, clearInvoiceSelection, clearPaymentSelection]);

  useModuleShortcuts({
    enabled: activeTab === "work",
    canWrite,
    showDeleted,
    onCreate: () => {
      setActiveTab("work");
      setActiveSubTab("invoices");
      modalState.setCreatingInvoice(true);
    },
    searchInputId: "finance-search-input",
    selectedCount: invoiceSelection.selectedIds.length + paymentSelection.selectedIds.length,
    clearSelection: () => {
      modalState.setViewInvoice(null);
      modalState.setRecordInvoice(null);
      modalState.setCreatingInvoice(false);
      clearInvoiceSelection();
      clearPaymentSelection();
    },
  });

  useEffect(() => {
    if (activeTab !== "work") setShowDeleted(false);
  }, [activeTab]);

  const { handleRecordPayment, handleCreateInvoice, openCreateInvoice } = useFinanceFormActions({
    createPayment,
    createInvoice,
    setRecordInvoice: modalState.setRecordInvoice,
    setCreatingInvoice: modalState.setCreatingInvoice,
    setActiveTab,
    setActiveSubTab,
    t,
  });

  const { mutationError, handleBulkResult, handleBulkStatusChange } = useFinanceBulkActions({
    bulkUpdateInvoiceStatus,
    clearInvoiceSelection,
    clearPaymentSelection,
    t,
  });

  const { handleCollectOverdue, handleRemindInvoices, collectPending, remindPending } =
    useFinanceCollectActions({
      canWriteMessaging,
      openComposer,
      t,
    });

  return {
    activePayment,
    setActivePayment,
    t,
    canWrite,
    canDelete,
    PAGE_TABS,
    SUB_TABS,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    showDeleted,
    setShowDeleted,
    invoicesResult,
    paymentsResult,
    invoices,
    payments,
    createInvoice,
    canWriteMessaging,
    ...modalState,
    invoiceColumnLayout,
    paymentColumnLayout,
    handleRecordPayment,
    handleCreateInvoice,
    mutationError,
    handleBulkResult,
    openCreateInvoice,
    handleCollectOverdue,
    handleRemindInvoices,
    collectPending,
    remindPending,
    messagingTarget,
    closeComposer,
    deleteInvoice,
    restoreInvoice,
    bulkDeleteInvoices,
    bulkRestoreInvoices,
    deletePayment,
    restorePayment,
    bulkDeletePayments,
    bulkRestorePayments,
    bulkUpdateInvoiceStatus,
    handleBulkStatusChange,
    invoiceSelection,
    paymentSelection,
    invoiceStatusFilter,
  };
}

export type FinancePageController = ReturnType<typeof useFinancePageController>;
