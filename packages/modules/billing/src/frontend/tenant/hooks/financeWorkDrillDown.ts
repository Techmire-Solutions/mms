import { createModuleWorkDrillDown } from "@mms/fe-core/lib/createModuleWorkDrillDown";

export const FINANCE_WORK_DRILLDOWN_EVENT = "finance-work-drilldown";

export interface FinanceWorkDrillDown {
  /** Invoice status filter preset (empty clears the filter). */
  invoiceStatuses?: string[];
}

const { apply, consume } = createModuleWorkDrillDown<FinanceWorkDrillDown>({
  event: FINANCE_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_finance_work_drilldown",
});

export const applyFinanceWorkDrillDown = apply;
export const consumeFinanceWorkDrillDown = consume;
