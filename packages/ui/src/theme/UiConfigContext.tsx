import React, { createContext, useContext, useMemo } from "react";

export interface UiConfigLabels {
  cancel?: string;
  confirm?: string;
  delete?: string;
  close?: string;
  retry?: string;
  searchPlaceholder?: string;
  clearSearch?: string;
  loading?: string;
}

export interface UiConfig {
  dir?: "ltr" | "rtl";
  labels?: UiConfigLabels;
}

const DEFAULT_LABELS: Required<UiConfigLabels> = {
  cancel: "Cancel",
  confirm: "Confirm",
  delete: "Delete",
  close: "Close",
  retry: "Retry",
  searchPlaceholder: "Search…",
  clearSearch: "Clear Search",
  loading: "Loading…",
};

const UiConfigContext = createContext<UiConfig>({
  dir: "ltr",
  labels: DEFAULT_LABELS,
});

export interface UiConfigProviderProps {
  config?: UiConfig;
  children: React.ReactNode;
}

/**
 * Provides default labels and direction for @shared/ui components,
 * decoupling them from any console-specific i18n implementation.
 */
export function UiConfigProvider({ config, children }: UiConfigProviderProps): React.JSX.Element {
  const mergedConfig = useMemo<UiConfig>(() => {
    return {
      dir: config?.dir ?? "ltr",
      labels: {
        ...DEFAULT_LABELS,
        ...(config?.labels ?? {}),
      },
    };
  }, [config]);

  return <UiConfigContext.Provider value={mergedConfig}>{children}</UiConfigContext.Provider>;
}

export function useUiConfig(): {
  dir: "ltr" | "rtl";
  labels: Required<UiConfigLabels>;
} {
  const context = useContext(UiConfigContext);
  return {
    dir: context.dir ?? "ltr",
    labels: {
      ...DEFAULT_LABELS,
      ...(context.labels ?? {}),
    },
  };
}
