import type { WorkBatchTableProps } from "../WorkBatchTable";
import type { WorkTaskToolbarProps } from "../workTaskToolbarTypes";
import type { DataTableColumnLayout } from "./dataTableTypes";

/** Toolbar column-customizer config (visibility, order, reset) from a column layout. */
export function toColumnCustomizer(
  layout: DataTableColumnLayout | undefined,
): WorkTaskToolbarProps["columnCustomizer"] {
  if (!layout) return undefined;
  return {
    registry: layout.columnRegistry,
    onUpdate: layout.updateUserColumnLayout,
    onReset: layout.resetColumnLayout,
    labels: layout.customizerLabels,
  };
}

/** `WorkBatchTable` resize config from a column layout. */
export function toColumnResize(
  layout: DataTableColumnLayout | undefined,
): WorkBatchTableProps<{ id: string }>["columnResize"] {
  if (!layout) return undefined;
  return { getColumnWidth: layout.getColumnWidth, onColumnResize: layout.setColumnWidth };
}
