import { useMemo } from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { TableColumnDescriptor } from "@/components/common/entityRegistryTypes";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

/** Default column registry for an entity descriptor's table columns. */
export function descriptorColumnsToRegistry(
  columns: readonly TableColumnDescriptor[],
): ModuleColumnRegistryEntry[] {
  return columns.map((column) => ({
    key: column.id,
    label: column.label,
    order: column.order,
    enabled: column.enabled,
    fixed: column.fixed ?? false,
  }));
}

/** Descriptor columns in the user's order, limited to visible ones; all columns when no layout. */
export function resolveVisibleDescriptorColumns(
  columns: readonly TableColumnDescriptor[],
  registry?: readonly ModuleColumnRegistryEntry[],
): TableColumnDescriptor[] {
  if (!registry) return [...columns];
  const byId = new Map(columns.map((column) => [column.id, column]));
  return registry
    .filter((entry) => entry.enabled || entry.fixed)
    .toSorted((a, b) => a.order - b.order)
    .map((entry) => byId.get(entry.key))
    .filter((column): column is TableColumnDescriptor => column !== undefined);
}

/** Persisted per-user column visibility/order/width for a descriptor-driven table. */
export function useDescriptorColumnLayout(
  moduleId: string,
  descriptor: { getTableColumns: () => TableColumnDescriptor[] },
) {
  const tenantRegistry = useMemo(
    () => descriptorColumnsToRegistry(descriptor.getTableColumns()),
    [descriptor],
  );
  return useModuleColumnLayout({ moduleId, tenantRegistry });
}
