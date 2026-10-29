import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";

/** Directory filters and pagination SSOT for Finance Work. */
export function useFinanceDirectoryFilters() {
  const [invoiceListPage, setInvoiceListPage] = useState(1);
  const [paymentListPage, setPaymentListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const debouncedInvoiceSearch = useDebounce(invoiceSearch, 250);
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<string[]>([]);

  // Page 1 whenever a server-side filter dimension changes (render-phase reset, no effect).
  const invoiceFilterKey = `${debouncedInvoiceSearch}|${invoiceFilterStatus.join(",")}|${showDeleted}`;
  const [prevInvoiceFilterKey, setPrevInvoiceFilterKey] = useState(invoiceFilterKey);
  if (prevInvoiceFilterKey !== invoiceFilterKey) {
    setPrevInvoiceFilterKey(invoiceFilterKey);
    setInvoiceListPage(1);
  }

  // Trash mode also resets the payments pager (separate list, no invoice filters).
  const [prevShowDeleted, setPrevShowDeleted] = useState(showDeleted);
  if (prevShowDeleted !== showDeleted) {
    setPrevShowDeleted(showDeleted);
    setPaymentListPage(1);
  }

  const clearInvoiceStatuses = () => {
    setInvoiceFilterStatus([]);
  };

  const clearInvoiceFilters = () => {
    setInvoiceSearch("");
    setInvoiceFilterStatus([]);
  };

  const toggleInvoiceStatus = (status: string) => {
    setInvoiceFilterStatus((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  };

  const hasActiveInvoiceFilters = Boolean(invoiceSearch.trim()) || invoiceFilterStatus.length > 0;

  return {
    invoiceListPage,
    setInvoiceListPage,
    paymentListPage,
    setPaymentListPage,
    showDeleted,
    setShowDeleted,
    invoiceSearch,
    setInvoiceSearch,
    debouncedInvoiceSearch,
    invoiceFilterStatus,
    setInvoiceFilterStatus,
    toggleInvoiceStatus,
    clearInvoiceStatuses,
    clearInvoiceFilters,
    hasActiveInvoiceFilters,
  };
}
