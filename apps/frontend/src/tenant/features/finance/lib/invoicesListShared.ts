import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { StandardMessagingRecipient } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { Invoice } from "@/lib/data/financeData";
import type { InvoiceMessageChannel } from "@/tenant/features/finance/components/InvoicesRowActions";

export interface InvoicesListContentProps {
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
