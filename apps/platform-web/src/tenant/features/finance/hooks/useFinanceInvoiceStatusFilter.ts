import { useState } from "react";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import {
  FINANCE_WORK_DRILLDOWN_EVENT,
  consumeFinanceWorkDrillDown,
  type FinanceWorkDrillDown,
} from "./financeWorkDrillDown";

interface UseFinanceInvoiceStatusFilterArgs {
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (tab: string) => void;
  setShowDeleted: (showDeleted: boolean) => void;
}

/** Invoice status filter owned by the Finance controller so drill-downs (e.g. notifications) can preset it. */
export function useFinanceInvoiceStatusFilter({
  setActiveTab,
  setActiveSubTab,
  setShowDeleted,
}: UseFinanceInvoiceStatusFilterArgs) {
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  useWorkDrillDownListener<FinanceWorkDrillDown>(
    FINANCE_WORK_DRILLDOWN_EVENT,
    consumeFinanceWorkDrillDown,
    (drillDown) => {
      setActiveTab("work");
      setActiveSubTab("invoices");
      setShowDeleted(false);
      setFilterStatus(drillDown.invoiceStatuses ?? []);
    },
  );

  return { filterStatus, onFilterStatusChange: setFilterStatus };
}
