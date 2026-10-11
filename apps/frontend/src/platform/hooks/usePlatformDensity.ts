import { useState, useCallback, useMemo } from "react";

export type PlatformDensity = "compact" | "standard" | "comfortable";

const STORAGE_KEY = "mms_platform_density";

export interface PlatformDensityConfig {
  density: PlatformDensity;
  setDensity: (density: PlatformDensity) => void;
  rowHeight: number;
  cellPaddingClass: string;
  headerPaddingClass: string;
}

const DENSITY_CONFIG: Record<
  PlatformDensity,
  { rowHeight: number; cellPaddingClass: string; headerPaddingClass: string }
> = {
  compact: {
    rowHeight: 38,
    cellPaddingClass: "px-3 py-1.5 text-2xs",
    headerPaddingClass: "px-3 py-2 text-2xs",
  },
  standard: {
    rowHeight: 48,
    cellPaddingClass: "px-4 py-2.5 text-xs",
    headerPaddingClass: "px-4 py-2.5 text-xs",
  },
  comfortable: {
    rowHeight: 64,
    cellPaddingClass: "px-4 py-4 text-sm",
    headerPaddingClass: "px-4 py-3 text-xs",
  },
};

export function usePlatformDensity(): PlatformDensityConfig {
  const [density, setDensityState] = useState<PlatformDensity>(() => {
    if (typeof window === "undefined") return "standard";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "compact" || stored === "standard" || stored === "comfortable") {
        return stored;
      }
    } catch {
      // Ignore storage access errors
    }
    return "standard";
  });

  const setDensity = useCallback((newDensity: PlatformDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const config = useMemo(() => DENSITY_CONFIG[density], [density]);

  return {
    density,
    setDensity,
    rowHeight: config.rowHeight,
    cellPaddingClass: config.cellPaddingClass,
    headerPaddingClass: config.headerPaddingClass,
  };
}
