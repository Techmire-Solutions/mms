import type { ReactNode } from "react";
import type { JournalReversalRequest } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { Account, FiscalYear, JournalEntry } from "@/lib/data/accountingData";
import type { JournalEntriesListPaging } from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";
import type { JournalModalMode } from "@/tenant/features/accounting/components/JournalEntriesModalLayer";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import type { JournalEntrySave } from "./journalEntriesTypes";

export type JournalMode = "simple" | "advanced";

export interface JournalEntriesAdvancedModeProps {
  mode: JournalMode;
  modeTabs: Array<{ key: JournalMode; label: string }>;
  entries: JournalEntry[];
  allEntries?: JournalEntry[];
  filteredEntries: JournalEntry[];
  accounts: Account[];
  fiscalYears: FiscalYear[];
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  journalStatusConfig: Record<string, StatusBadgeConfigItem>;
  grandDebit: number;
  grandCredit: number;
  search: string;
  statusFilter: string;
  tagFilter: string;
  dateFrom: string;
  dateTo: string;
  /** Page/total/hasMore from the page that owns the server query. */
  paging: JournalEntriesListPaging;
  showFilters: boolean;
  modal: JournalModalMode;
  selected: JournalEntry | null;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  onToggleDeleted?: () => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  renderEntryActions: (entry: JournalEntry) => ReactNode;
  renderEntryActionsCards: (entry: JournalEntry) => ReactNode;
  formatAmount: (amount: number) => string;
  onModeChange: (mode: JournalMode) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onShowFiltersChange: (showFilters: boolean) => void;
  onOpenNew: () => void;
  onRequestBulkTrash: () => void;
  onConfirmBulkTrash: () => void;
  onConfirmRowTrash: () => void;
  onExportCsv: () => void;
  onToggleSelectedEntry: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onSave: JournalEntrySave;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  onCloseModal: () => void;
  onEditSelected: () => void;
  onViewEntry: (entry: JournalEntry) => void;
  onRequestReverse: (entry: JournalEntry) => void;
  onConfirmReverse: (request: JournalReversalRequest) => Promise<boolean>;
  pendingTrashId: string | null;
  confirmBulkOpen: boolean;
  pendingReverseEntry: JournalEntry | null;
  onPendingTrashIdChange: (id: string | null) => void;
  onConfirmBulkOpenChange: (open: boolean) => void;
  onPendingReverseEntryChange: (entry: JournalEntry | null) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  pageScopeLabel: string;
  onRestoreEntry?: (id: string) => void | Promise<void>;
}
