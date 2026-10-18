import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { Denomination, Distribution } from "@/lib/data/hasanatData";

export type DistributionStatus = Distribution["status"];

export const DISTRIBUTION_COLUMN_KEYS = [
  "card",
  "recipient",
  "recipientClass",
  "quantity",
  "reason",
  "issuedDate",
  "issuedBy",
  "status",
] as const;

export interface DistributionsListContentProps {
  viewMode: WorkDirectoryViewMode;
  distributions: Distribution[];
  denoms: Denomination[];
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  statusLabels: Record<DistributionStatus, string>;
  statusConfig: Record<DistributionStatus, StatusBadgeConfigItem>;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  canRestoreRows: boolean;
  canDeleteRows: boolean;
  onMessage?: (channel: "sms" | "whatsapp" | "email", distributions: Distribution[]) => void;
  onChangeStatus: (id: string, status: DistributionStatus) => void;
  onToggleSelectedDistribution: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onTrashAction: (id: string) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onRowClick?: (id: string) => void;
}

export function getDistributionDenomination(
  denoms: Denomination[] | Map<string, Denomination>,
  denominationId: string,
): Denomination | undefined {
  if (denoms instanceof Map) {
    return denoms.get(denominationId);
  }
  return denoms.find((denomination) => denomination.id === denominationId);
}

export function getDistributionStatuses(
  statusConfig: Record<DistributionStatus, StatusBadgeConfigItem>,
): DistributionStatus[] {
  return Object.keys(statusConfig) as DistributionStatus[];
}
