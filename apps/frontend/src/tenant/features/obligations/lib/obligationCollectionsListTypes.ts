import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";
import type { ModuleColumnCustomizerProps } from "@/components/ui/ModuleColumnCustomizer";

export interface ObligationCollectionListProps {
  collections: ObligationCollection[];
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  onAddNew: () => void;
  onView: (collection: ObligationCollection) => void;
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  canDelete?: boolean;
  showDeleted?: boolean;
  onToggleShowDeleted?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  selectedIds?: string[];
  onToggleSelectedCollection?: (id: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onClearSelection?: () => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer?: ModuleColumnCustomizerProps;
  onMessage?: (channel: "sms" | "whatsapp" | "email", collections: ObligationCollection[]) => void;
}
