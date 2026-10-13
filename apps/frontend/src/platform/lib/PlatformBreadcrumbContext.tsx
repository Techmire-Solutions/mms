import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { BreadcrumbItem } from "@/components/app/Breadcrumb";

export type PlatformBreadcrumbSegment = BreadcrumbItem;

interface PlatformBreadcrumbContextValue {
  extraSegments: readonly PlatformBreadcrumbSegment[];
  setExtraSegments: (segments: readonly PlatformBreadcrumbSegment[]) => void;
  clearExtraSegments: () => void;
}

const PlatformBreadcrumbContext = createContext<PlatformBreadcrumbContextValue | null>(null);

export function PlatformBreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [extraSegments, setExtraSegmentsState] = useState<readonly PlatformBreadcrumbSegment[]>([]);

  const setExtraSegments = useCallback((segments: readonly PlatformBreadcrumbSegment[]) => {
    setExtraSegmentsState(segments);
  }, []);

  const clearExtraSegments = useCallback(() => {
    setExtraSegmentsState([]);
  }, []);

  const value = useMemo(
    () => ({ extraSegments, setExtraSegments, clearExtraSegments }),
    [extraSegments, setExtraSegments, clearExtraSegments],
  );

  return (
    <PlatformBreadcrumbContext.Provider value={value}>
      {children}
    </PlatformBreadcrumbContext.Provider>
  );
}

export function usePlatformBreadcrumb(): PlatformBreadcrumbContextValue {
  const ctx = useContext(PlatformBreadcrumbContext);
  if (!ctx) {
    return {
      extraSegments: [],
      setExtraSegments: () => {},
      clearExtraSegments: () => {},
    };
  }
  return ctx;
}
