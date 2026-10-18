import React, { createContext, useContext, useMemo } from "react";

export interface UiConfigLabels {
  cancel?: string;
  save?: string;
  saving?: string;
  confirm?: string;
  delete?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  rowsPerPage?: string;
  pageOf?: (page: number, total: number) => string;
  previous?: string;
  next?: string;
  close?: string;
}

export interface UiConfig {
  dir?: "ltr" | "rtl";
  labels?: UiConfigLabels;
}

const DEFAULT_LABELS: Required<Omit<UiConfigLabels, "pageOf">> & {
  pageOf: (page: number, total: number) => string;
} = {
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  confirm: "Confirm",
  delete: "Delete",
  searchPlaceholder: "Search...",
  emptyTitle: "No records found",
  emptyDescription: "Try adjusting your search or filters.",
  rowsPerPage: "Rows per page",
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
  previous: "Previous",
  next: "Next",
  close: "Close",
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
  labels: Required<Omit<UiConfigLabels, "pageOf">> & {
    pageOf: (page: number, total: number) => string;
  };
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
