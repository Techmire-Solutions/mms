import type { ModuleWorkToolbarProps } from "@/components/app/moduleWorkToolbarTypes";

export interface WorkTaskStatusOption {
  id: string;
  label: string;
  count?: number;
  badgeCls?: string;
}

/**
 * Full Work-toolbar composition: the base contract plus the optional status-pill and
 * date-range rows. Control shapes are inherited from `ModuleWorkToolbarProps` so the
 * two layers cannot drift.
 */
export interface WorkTaskToolbarProps extends ModuleWorkToolbarProps {
  /** Status quick-filter pills rendered below the base toolbar. */
  statusFilter?: {
    activeIds: string[];
    options: WorkTaskStatusOption[];
    onToggle: (id: string) => void;
    allLabel?: string;
    onResetAll?: () => void;
  };

  /** Due-date range controls rendered beside the status pills. */
  dateRange?: {
    startDate?: string;
    endDate?: string;
    onDateRangeChange: (range: { start?: string; end?: string }) => void;
    startPlaceholder?: string;
    endPlaceholder?: string;
  };
}
