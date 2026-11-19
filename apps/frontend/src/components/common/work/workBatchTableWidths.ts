/**
 * @file workBatchTableWidths.ts
 * @description Column width resolution for WorkBatchTable: kind defaults, stale-width floors, table minimum.
 */
import {
  MODULE_COLUMN_KIND_WIDTHS,
  resolveModuleColumnWidth,
  type ModuleColumnKind,
} from "@mms/shared";

/** Selection checkbox column (`w-12`). */
export const WORK_TABLE_SELECTION_WIDTH = 48;
/** Default row-actions column width in px (`w-28`). */
export const WORK_TABLE_ACTIONS_WIDTH = 112;
/** Default row-actions column width class — SSOT for the header + cell default. */
export const WORK_TABLE_ACTIONS_WIDTH_CLASS = "w-28 min-w-28";
/** Wide row-actions column width in px (`w-56`, e.g. Platform inline action rows). */
export const WORK_TABLE_ACTIONS_WIDTH_WIDE = 224;
/** Space reserved for a column that has neither a width nor a kind. */
export const WORK_TABLE_UNSIZED_COLUMN_FLOOR = 120;

interface WidthSource {
  width?: number;
  kind?: ModuleColumnKind;
}

/** Effective width: stored width, else the column default, floored by the column kind. */
export function resolveWorkColumnWidth(
  column: WidthSource,
  storedWidth: number | undefined,
): number | undefined {
  return resolveModuleColumnWidth(storedWidth ?? column.width, column.kind);
}

/** Narrowest width a user may drag the column to (kind floor), or `undefined` for the global default. */
export function resolveWorkColumnMinWidth(column: WidthSource): number | undefined {
  return column.kind ? MODULE_COLUMN_KIND_WIDTHS[column.kind].minWidth : undefined;
}

/**
 * Minimum table width so columns keep their widths and the container scrolls horizontally
 * instead of squeezing every column to fit.
 */
export function computeWorkTableMinWidth(
  widths: readonly (number | undefined)[],
  chrome: { selection: boolean; actions: boolean; actionsWidth?: number },
): number {
  const columns = widths.reduce<number>(
    (total, width) => total + (width ?? WORK_TABLE_UNSIZED_COLUMN_FLOOR),
    0,
  );
  return (
    columns +
    (chrome.selection ? WORK_TABLE_SELECTION_WIDTH : 0) +
    (chrome.actions ? (chrome.actionsWidth ?? WORK_TABLE_ACTIONS_WIDTH) : 0)
  );
}
