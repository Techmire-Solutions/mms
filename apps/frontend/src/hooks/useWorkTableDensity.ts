import { useCallback, useState } from "react";
import type { DensityMode } from "@shared/ui";

/**
 * Work-directory table row density. Padding-based (not fixed row height) so
 * variable-height cells — identity cells with avatar + meta, stacked phone/email
 * action lists — never clip. `standard` matches the long-standing `px-4 py-3`.
 * Alias of `@shared/ui`'s `DensityMode` so the toggle and the table share one type.
 */
export type WorkTableDensity = DensityMode;

const STORAGE_KEY = "mms_work_table_density";

/** Padding classes for data/selection/actions cells and their headers. */
export const WORK_TABLE_DENSITY_PADDING: Record<
  WorkTableDensity,
  { cell: string; header: string }
> = {
  compact: { cell: "px-3 py-2", header: "px-3 py-2" },
  standard: { cell: "px-4 py-3", header: "px-4 py-3" },
  comfortable: { cell: "px-4 py-4", header: "px-4 py-3" },
};

export interface WorkTableDensityConfig {
  density: WorkTableDensity;
  setDensity: (density: WorkTableDensity) => void;
  cellPaddingClass: string;
  headerPaddingClass: string;
}

/** Per-user, persisted Work table density (SSOT for the WorkBatchTable stack). */
export function useWorkTableDensity(): WorkTableDensityConfig {
  const [density, setDensityState] = useState<WorkTableDensity>(() => {
    if (typeof window === "undefined") return "standard";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "compact" || stored === "standard" || stored === "comfortable") {
        return stored;
      }
    } catch {
      // Ignore storage access errors.
    }
    return "standard";
  });

  const setDensity = useCallback((next: WorkTableDensity) => {
    setDensityState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  return {
    density,
    setDensity,
    cellPaddingClass: WORK_TABLE_DENSITY_PADDING[density].cell,
    headerPaddingClass: WORK_TABLE_DENSITY_PADDING[density].header,
  };
}
