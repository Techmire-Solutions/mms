import { useState } from "react";
import type { Invoice } from "@/lib/data/financeData";

export function useFinanceModalState() {
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [recordInvoice, setRecordInvoice] = useState<Invoice | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  return {
    viewInvoice,
    setViewInvoice,
    recordInvoice,
    setRecordInvoice,
    creatingInvoice,
    setCreatingInvoice,
    generatingInvoices,
    setGeneratingInvoices,
  };
}
