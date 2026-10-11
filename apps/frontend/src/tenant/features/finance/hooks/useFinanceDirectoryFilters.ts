import { useEffect, useState } from "react";
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

  useEffect(() => {
    setInvoiceListPage(1);
  }, [debouncedInvoiceSearch, invoiceFilterStatus, showDeleted]);

  useEffect(() => {
    setPaymentListPage(1);
  }, [showDeleted]);

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
