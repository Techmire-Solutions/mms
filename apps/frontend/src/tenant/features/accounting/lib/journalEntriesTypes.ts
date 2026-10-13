import type {
  Account,
  AccountingSettings,
  FiscalYear,
  JournalEntry,
} from "@/lib/data/accountingData";
import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";

/** Resolves with the entries as the server saved them (server-assigned voucher refs included). */
export type JournalEntriesChange = (
  entries: JournalEntry[] | ((prev: JournalEntry[]) => JournalEntry[]),
) => void | JournalEntry[] | Promise<void | JournalEntry[]>;

/** Resolves with the saved entry when the caller can report its voucher number. */
export type JournalEntrySave = (
  entry: JournalEntry,
  stayOpen?: boolean,
) => void | JournalEntry | Promise<void | JournalEntry>;

export interface JournalEntriesProps {
  entries: JournalEntry[];
  allEntries?: JournalEntry[];
  accounts: Account[];
  settings: AccountingSettings;
  fiscalYears: FiscalYear[];
  onChange: JournalEntriesChange;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  onFilteredCountChange?: (count: number) => void;
  onShortcutStateChange?: (state: {
    mode: "simple" | "advanced";
    selectedCount: number;
    clearSelection: () => void;
  }) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  createRequestKey?: number;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
}
