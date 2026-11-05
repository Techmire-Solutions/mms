import React from "react";
import {
  DEFAULT_COLUMN_REGISTRY,
  DEFAULT_FORM_TABS,
  syncContactColumnRegistryWithFields,
  getContactColumnKind,
  resolveModuleColumnWidth,
  CONTACTS_MODULE_MANIFEST,
  type ColumnRegistryEntry,
  type FieldDefinition,
} from "@mms/shared";
import { useUiPreference } from "@/lib/useUiStateStore";

export interface ContactConfigColumnLayoutOptions {
  baseColumnRegistry?: ColumnRegistryEntry[];
  resolvedFields: Record<string, FieldDefinition[]>;
  enabledTabs: string[];
}

export function useContactConfigColumnLayout({
  baseColumnRegistry,
  resolvedFields,
  enabledTabs,
}: ContactConfigColumnLayoutOptions) {
  const prefKey = `${CONTACTS_MODULE_MANIFEST.moduleId}.table.columns`;
  const [userOverlayRaw, setUserOverlayRaw] = useUiPreference<ColumnRegistryEntry[] | null>(
    prefKey,
    null,
  );

  const columnRegistry = React.useMemo(() => {
    if (userOverlayRaw && userOverlayRaw.length > 0) {
      return userOverlayRaw;
    }
    return baseColumnRegistry?.length ? baseColumnRegistry : DEFAULT_COLUMN_REGISTRY;
  }, [userOverlayRaw, baseColumnRegistry]);

  const syncedColumnRegistry = React.useMemo(() => {
    const synced = syncContactColumnRegistryWithFields(
      columnRegistry,
      resolvedFields,
      enabledTabs.length > 0
        ? enabledTabs
        : DEFAULT_FORM_TABS.filter((t) => t.enabled).map((t) => t.key),
    );
    // Stored overlays predate column kinds: recover the kind by key and floor stale widths.
    return synced.map((entry) => {
      const kind = entry.kind ?? getContactColumnKind(entry.key);
      if (!kind) return entry;
      return { ...entry, kind, width: resolveModuleColumnWidth(entry.width, kind) };
    });
  }, [columnRegistry, resolvedFields, enabledTabs]);

  const updateUserColumnLayout = React.useCallback(
    (layout: ColumnRegistryEntry[]) => {
      setUserOverlayRaw(layout);
    },
    [setUserOverlayRaw],
  );

  const getColumnWidth = React.useCallback(
    (key: string) => {
      return syncedColumnRegistry.find((c) => c.key === key)?.width;
    },
    [syncedColumnRegistry],
  );

  const setColumnWidth = React.useCallback(
    (key: string, width: number) => {
      setUserOverlayRaw(
        columnRegistry.map((c: ColumnRegistryEntry) => (c.key === key ? { ...c, width } : c)),
      );
    },
    [columnRegistry, setUserOverlayRaw],
  );

  const isColumnVisible = React.useCallback(
    (key: string) => {
      return syncedColumnRegistry.find((c) => c.key === key)?.enabled ?? false;
    },
    [syncedColumnRegistry],
  );

  const availableColumns = React.useMemo(() => {
    return syncedColumnRegistry.map((entry) => ({
      id: entry.key,
      label: entry.label,
      sortField: entry.sortField,
      width: entry.width,
      kind: entry.kind,
    }));
  }, [syncedColumnRegistry]);

  const visibleColumns = React.useMemo(() => {
    return syncedColumnRegistry
      .filter((entry) => entry.enabled)
      .map((entry) => ({
        id: entry.key,
        label: entry.label,
        sortField: entry.sortField,
        width: entry.width,
      }));
  }, [syncedColumnRegistry]);

  return {
    syncedColumnRegistry,
    availableColumns,
    visibleColumns,
    updateUserColumnLayout,
    getColumnWidth,
    setColumnWidth,
    isColumnVisible,
  };
}
