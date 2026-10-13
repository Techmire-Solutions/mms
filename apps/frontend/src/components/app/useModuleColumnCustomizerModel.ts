import React, { useState } from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { descriptorColumnsToRegistry } from "@/hooks/useDescriptorColumnLayout";
import { getEntityDescriptor } from "@/components/common/entityRegistry";
import type {
  ModuleColumnCustomizerLabels,
  ModuleColumnCustomizerProps,
} from "@/components/ui/moduleColumnCustomizerTypes";

export interface UseModuleColumnCustomizerModelOptions {
  columnRegistry?: ModuleColumnRegistryEntry[];
  entityType?: ModuleColumnCustomizerProps["entityType"];
  descriptor?: ModuleColumnCustomizerProps["descriptor"];
  updateUserColumnLayout: (columns: ModuleColumnRegistryEntry[]) => void;
  labels?: Partial<ModuleColumnCustomizerLabels>;
}

export function useModuleColumnCustomizerModel({
  columnRegistry,
  entityType,
  descriptor,
  updateUserColumnLayout,
  labels,
}: UseModuleColumnCustomizerModelOptions) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveDescriptor =
    descriptor ?? (entityType ? getEntityDescriptor(entityType) : undefined);

  const registry = React.useMemo(() => {
    if (columnRegistry && columnRegistry.length > 0) return columnRegistry;
    if (effectiveDescriptor) {
      return descriptorColumnsToRegistry(effectiveDescriptor.getTableColumns());
    }
    return [];
  }, [columnRegistry, effectiveDescriptor]);

  const resolvedLabels: ModuleColumnCustomizerLabels = {
    trigger: labels?.trigger ?? t("common.columns.trigger"),
    title: labels?.title ?? t("common.columns.title"),
    visibleAndOrder: labels?.visibleAndOrder ?? t("common.columns.visibleAndOrder"),
    hidden: labels?.hidden ?? t("common.columns.hidden"),
    fixed: labels?.fixed ?? t("common.columns.fixed"),
    hideColumn:
      labels?.hideColumn ?? ((label: string) => t("common.columns.hideColumn", { label })),
    showColumn:
      labels?.showColumn ?? ((label: string) => t("common.columns.showColumn", { label })),
    reset: labels?.reset ?? t("common.columns.reset"),
    searchPlaceholder: labels?.searchPlaceholder ?? t("common.columns.searchPlaceholder"),
    showAll: labels?.showAll ?? t("common.columns.showAll"),
    hideAll: labels?.hideAll ?? t("common.columns.hideAll"),
    visibleCount:
      labels?.visibleCount ??
      ((visible: number, total: number) => t("common.columns.visibleCount", { visible, total })),
    noMatches: labels?.noMatches ?? t("common.columns.noMatches"),
  };

  const visibleColumns = React.useMemo(
    () =>
      [...registry]
        .filter((column) => column.enabled)
        .sort((firstColumn, secondColumn) => firstColumn.order - secondColumn.order)
        .filter(
          (column) =>
            !searchQuery || column.label.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    [registry, searchQuery],
  );

  const hiddenColumns = React.useMemo(
    () =>
      [...registry]
        .filter((column) => !column.enabled)
        .filter(
          (column) =>
            !searchQuery || column.label.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    [registry, searchQuery],
  );

  const toggle = (columnKey: string): void => {
    const updated = registry.map((column) => {
      if (column.key === columnKey) {
        if (column.fixed) return column;
        return { ...column, enabled: !column.enabled };
      }
      return column;
    });
    updateUserColumnLayout(updated);
  };

  const showAll = (): void => {
    const updated = registry.map((column) => ({ ...column, enabled: true }));
    updateUserColumnLayout(updated);
  };

  const hideAll = (): void => {
    const updated = registry.map((column) =>
      column.fixed ? column : { ...column, enabled: false },
    );
    updateUserColumnLayout(updated);
  };

  const hasNonFixedHidden = registry.some((c) => !c.enabled && !c.fixed);
  const hasNonFixedVisible = registry.some((c) => c.enabled && !c.fixed);
  const hiddenCount = registry.filter((c) => !c.enabled && !c.fixed).length;

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, columnKey: string): void => {
    setDragging(columnKey);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, columnKey: string): void => {
    event.preventDefault();
    if (columnKey !== dragging) setDragOver(columnKey);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetColumnKey: string): void => {
    event.preventDefault();
    if (!dragging || dragging === targetColumnKey) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    const allVisible = [...registry].filter((col) => col.enabled).sort((a, b) => a.order - b.order);
    const visibleIds = allVisible.map((column) => column.key);
    const fromIdx = visibleIds.indexOf(dragging);
    const toIdx = visibleIds.indexOf(targetColumnKey);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newVisibleIds = [...visibleIds];
      const [moved] = newVisibleIds.splice(fromIdx, 1);
      newVisibleIds.splice(toIdx, 0, moved);
      const updated = registry.map((column) => {
        const orderIdx = newVisibleIds.indexOf(column.key);
        if (orderIdx !== -1) {
          return { ...column, order: orderIdx };
        }
        return column;
      });
      updateUserColumnLayout(updated);
    }
    setDragging(null);
    setDragOver(null);
  };

  const clearDrag = (): void => {
    setDragging(null);
    setDragOver(null);
  };

  const moveColumn = (columnKey: string, direction: "up" | "down"): void => {
    const allVisible = [...registry].filter((col) => col.enabled).sort((a, b) => a.order - b.order);
    const visibleIds = allVisible.map((column) => column.key);
    const fromIdx = visibleIds.indexOf(columnKey);
    if (fromIdx === -1) return;
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= visibleIds.length) return;

    const newVisibleIds = [...visibleIds];
    const [moved] = newVisibleIds.splice(fromIdx, 1);
    if (!moved) return;
    newVisibleIds.splice(toIdx, 0, moved);

    const updated = registry.map((column) => {
      const orderIdx = newVisibleIds.indexOf(column.key);
      if (orderIdx !== -1) {
        return { ...column, order: orderIdx };
      }
      return column;
    });
    updateUserColumnLayout(updated);
  };

  return {
    t,
    registry,
    resolvedLabels,
    searchQuery,
    setSearchQuery,
    visibleColumns,
    hiddenColumns,
    hiddenCount,
    hasNonFixedHidden,
    hasNonFixedVisible,
    dragging,
    dragOver,
    toggle,
    showAll,
    hideAll,
    handleDragStart,
    handleDragOver,
    handleDrop,
    clearDrag,
    moveColumn,
  };
}
