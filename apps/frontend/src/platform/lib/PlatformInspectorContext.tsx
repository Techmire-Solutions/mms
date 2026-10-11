import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Read-only entity shown in the contextual utility drawer. */
export interface PlatformInspectorWorkspace {
  kind: "workspace";
  subdomain: string;
  madrasaName: string;
  enabled: boolean;
  createdAt?: string;
  adminEmail?: string;
}

export type PlatformInspectorTarget = PlatformInspectorWorkspace;

interface PlatformInspectorContextValue {
  target: PlatformInspectorTarget | null;
  openInspector: (target: PlatformInspectorTarget) => void;
  closeInspector: () => void;
}

const PlatformInspectorContext = createContext<PlatformInspectorContextValue | null>(null);

export function PlatformInspectorProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [target, setTarget] = useState<PlatformInspectorTarget | null>(null);

  const openInspector = useCallback((next: PlatformInspectorTarget) => {
    setTarget(next);
  }, []);

  const closeInspector = useCallback(() => {
    setTarget(null);
  }, []);

  const value = useMemo(
    () => ({ target, openInspector, closeInspector }),
    [target, openInspector, closeInspector],
  );

  return (
    <PlatformInspectorContext.Provider value={value}>{children}</PlatformInspectorContext.Provider>
  );
}

export function usePlatformInspector(): PlatformInspectorContextValue {
  const ctx = useContext(PlatformInspectorContext);
  if (!ctx) {
    return {
      target: null,
      openInspector: () => {},
      closeInspector: () => {},
    };
  }
  return ctx;
}
