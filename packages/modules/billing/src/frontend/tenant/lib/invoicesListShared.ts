import type { ModuleColumnRegistryEntry } from "@mms/contracts";
import type { WorkDirectoryViewMode } from "@mms/fe-core/tenant";
import type { StandardMessagingRecipient } from "@mms/contracts";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import type { Invoice } from "./financeData";
import type { InvoiceMessageChannel } from "../components/InvoicesRowActions";

export interface InvoicesListContentProps {
  /** First page still loading: show rows, not the empty state. */
  isLoading?: boolean;
  viewMode: WorkDirectoryViewMode;
  invoices: Invoice[];
  isColumnVisible: (key: string) => boolean;
  visibleColCount: number;
  columnRegistry: ModuleColumnRegistryEntry[];
  canSelectInvoices: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging: boolean;
  showDeleted: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  formatCurrency: (amount: number) => string;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onView: (invoice: Invoice) => void;
  onRecord: (invoice: Invoice) => void;
  onRequestDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedInvoice: (id: string, checked: boolean) => void;
  openComposer: (channel: InvoiceMessageChannel, recipients: StandardMessagingRecipient[]) => void;
}
