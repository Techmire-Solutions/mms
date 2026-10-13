import type { AppTranslationKey } from "@mms/shared";
import type {
  ChartOperation,
  ChartType,
  CollectionMeta,
  FilterRule,
} from "@/components/ui/reports/dynamicChartVisualizerTypes";

export interface DynamicChartVisualizerConfigPanelProps {
  title: string;
  setTitle: (value: string) => void;
  collectionKey: string;
  setCollectionKey: (value: string) => void;
  xAxisField: string;
  setXAxisField: (value: string) => void;
  operation: ChartOperation;
  setOperation: (value: ChartOperation) => void;
  targetField: string;
  setTargetField: (value: string) => void;
  chartType: ChartType;
  setChartType: (value: ChartType) => void;
  activePalette: string;
  setActivePalette: (value: string) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  showLegend: boolean;
  setShowLegend: (value: boolean) => void;
  showTooltip: boolean;
  setShowTooltip: (value: boolean) => void;
  filters: FilterRule[];
  activeMeta: CollectionMeta;
  metadataConfigs: Record<string, CollectionMeta>;
  onAddFilter: () => void;
  onUpdateFilter: (id: string, updates: Partial<FilterRule>) => void;
  onDeleteFilter: (id: string) => void;
  t: (key: AppTranslationKey) => string;
}

export type DynamicChartVisualizerFiltersPanelProps = Pick<
  DynamicChartVisualizerConfigPanelProps,
  "filters" | "activeMeta" | "onAddFilter" | "onUpdateFilter" | "onDeleteFilter" | "t"
>;
