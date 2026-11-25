import type React from "react";
import {
  TrendingUp,
  List,
  BookMarked,
  Scale,
  BookOpen,
  LayoutDashboard,
  Landmark,
  CalendarCheck,
} from "lucide-react";

export const ACCOUNTING_SUB_TAB_IDS = [
  "overview",
  "journal",
  "ledger",
  "trial",
  "coa",
  "banking",
  "periodEnd",
] as const;
export type AccountingSubTabId = (typeof ACCOUNTING_SUB_TAB_IDS)[number];

export const ACCOUNTING_SUB_TAB_ICONS: Record<AccountingSubTabId, React.ElementType> = {
  overview: LayoutDashboard,
  journal: List,
  ledger: BookMarked,
  trial: Scale,
  coa: BookOpen,
  banking: Landmark,
  periodEnd: CalendarCheck,
};

export const ACCOUNTING_SUB_TAB_KEYS: Record<
  AccountingSubTabId,
  | "accounting.tabs.overview"
  | "accounting.tabs.journal"
  | "accounting.tabs.ledger"
  | "accounting.tabs.trial"
  | "accounting.tabs.coa"
  | "accounting.tabs.banking"
  | "accounting.tabs.periodEnd"
> = {
  overview: "accounting.tabs.overview",
  journal: "accounting.tabs.journal",
  ledger: "accounting.tabs.ledger",
  trial: "accounting.tabs.trial",
  coa: "accounting.tabs.coa",
  banking: "accounting.tabs.banking",
  periodEnd: "accounting.tabs.periodEnd",
};

export const ACCOUNTING_PAGE_ICON = TrendingUp;
