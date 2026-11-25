import type { DensityMode } from "@mms/ui";
import { useWorkTableDensity } from "@mms/fe-core/hooks/useWorkTableDensity";

export type PlatformDensity = DensityMode;

const STORAGE_KEY = "mms_platform_density";

export interface PlatformDensityConfig {
  density: PlatformDensity;
  setDensity: (density: PlatformDensity) => void;
  rowHeight: number;
  cellPaddingClass: string;
  headerPaddingClass: string;
}

const PLATFORM_DENSITY_PADDING: Record<PlatformDensity, { cell: string; header: string }> = {
  compact: {
    cell: "px-3 py-1.5 text-2xs",
    header: "px-3 py-2 text-2xs",
  },
  standard: {
    cell: "px-4 py-2.5 text-xs",
    header: "px-4 py-2.5 text-xs",
  },
  comfortable: {
    cell: "px-4 py-4 text-sm",
    header: "px-4 py-3 text-xs",
  },
};

const PLATFORM_DENSITY_ROW_HEIGHT: Record<PlatformDensity, number> = {
  compact: 38,
  standard: 48,
  comfortable: 64,
};

/**
 * Platform workspace-table density — thin adapter over the shared persisted
 * density hook, keeping the platform storage key and return shape.
 */
export function usePlatformDensity(): PlatformDensityConfig {
  const { density, setDensity, cellPaddingClass, headerPaddingClass } = useWorkTableDensity({
    storageKey: STORAGE_KEY,
    padding: PLATFORM_DENSITY_PADDING,
  });

  return {
    density,
    setDensity,
    rowHeight: PLATFORM_DENSITY_ROW_HEIGHT[density],
    cellPaddingClass,
    headerPaddingClass,
  };
}
