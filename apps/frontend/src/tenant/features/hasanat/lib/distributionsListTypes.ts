import type { Denomination, Distribution, StockBatch } from "@/lib/data/hasanatData";
import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";

export interface DistributionsListProps {
  denoms: Denomination[];
  batches: StockBatch[];
  onCreate: (distribution: Distribution) => void | Promise<void>;
  onUpdate: (distribution: Distribution) => void | Promise<void>;
  onDenomsChange?: (denoms: Denomination[]) => void | Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleDeleted?: () => void;
  createRequestKey?: number;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  selectedIds?: string[];
  onToggleSelectedDistribution?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onMessage?: (channel: "sms" | "whatsapp" | "email", distributions: Distribution[]) => void;
  onRowClick?: (distribution: Distribution) => void;
}
