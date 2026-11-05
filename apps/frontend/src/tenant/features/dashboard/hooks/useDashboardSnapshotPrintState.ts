import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useDashboardPrintSnapshot } from "./useDashboardPrintSnapshot";

export interface DashboardSnapshotPrintState {
  showAllMetrics: boolean;
  showInsights: boolean;
  setShowAllMetrics: Dispatch<SetStateAction<boolean>>;
  setShowInsights: Dispatch<SetStateAction<boolean>>;
  /** Expands the snapshot, prints, then restores the on-screen disclosure state. */
  printSnapshot: () => void;
}

/**
 * Disclosure state for the two dashboard "show more" groups, plus the print
 * snapshot that must expand both and then put them back (2026-11-05 review).
 */
export function useDashboardSnapshotPrintState(): DashboardSnapshotPrintState {
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const previousRef = useRef<{ metrics: boolean; insights: boolean } | null>(null);

  const expand = useCallback(() => {
    previousRef.current = { metrics: showAllMetrics, insights: showInsights };
    setShowAllMetrics(true);
    setShowInsights(true);
  }, [showAllMetrics, showInsights]);

  const restore = useCallback(() => {
    const previous = previousRef.current;
    previousRef.current = null;
    if (!previous) return;
    setShowAllMetrics(previous.metrics);
    setShowInsights(previous.insights);
  }, []);

  const printSnapshot = useDashboardPrintSnapshot(expand, restore);

  return { showAllMetrics, showInsights, setShowAllMetrics, setShowInsights, printSnapshot };
}
