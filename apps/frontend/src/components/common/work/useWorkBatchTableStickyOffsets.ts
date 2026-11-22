import React from "react";
import {
  computeStickyOffsets,
  WORK_TABLE_ACTIONS_WIDTH,
  WORK_TABLE_SELECTION_WIDTH,
  WORK_TABLE_UNSIZED_COLUMN_FLOOR,
} from "./workBatchTableWidths";

interface UseWorkBatchTableStickyOffsetsOptions {
  stickyColumnId?: string;
  stickyColumnIds?: string[];
  stickyEndColumnIds?: string[];
  resolvedWidths: Map<string, number | undefined>;
  hasSelection: boolean;
  hasRowActions: boolean;
  actionsWidth?: number;
}

/**
 * Pinned-column offsets for WorkBatchTable: ordered left/right lists with cumulative
 * sticky offsets. The offsets must be referentially stable so they don't defeat
 * WorkBatchTableRow's React.memo. They depend only on the pinned ids and their resolved
 * widths — not on the `resolvedWidths` Map identity, which churns because some shells
 * (DataTable) pass an un-memoized `columnResize` config each render.
 */
export function useWorkBatchTableStickyOffsets({
  stickyColumnId,
  stickyColumnIds,
  stickyEndColumnIds,
  resolvedWidths,
  hasSelection,
  hasRowActions,
  actionsWidth,
}: UseWorkBatchTableStickyOffsetsOptions): {
  leftPinnedIds: string[];
  rightPinnedIds: string[];
  stickyLeftOffsets: Record<string, number>;
  stickyRightOffsets: Record<string, number>;
} {
  const leftPinnedIds = stickyColumnIds ?? (stickyColumnId ? [stickyColumnId] : []);
  const rightPinnedIds = stickyEndColumnIds ?? [];
  const pinnedWidthsSignature = [...leftPinnedIds, ...rightPinnedIds]
    .map((id) => `${id}:${resolvedWidths.get(id) ?? WORK_TABLE_UNSIZED_COLUMN_FLOOR}`)
    .join("|");
  const leftPinnedKey = leftPinnedIds.join("\u0000");
  const rightPinnedKey = rightPinnedIds.join("\u0000");

  const { stickyLeftOffsets, stickyRightOffsets } = React.useMemo(() => {
    const effectiveWidth = (id: string) =>
      resolvedWidths.get(id) ?? WORK_TABLE_UNSIZED_COLUMN_FLOOR;
    return {
      stickyLeftOffsets: computeStickyOffsets(
        leftPinnedIds,
        effectiveWidth,
        hasSelection ? WORK_TABLE_SELECTION_WIDTH : 0,
      ),
      stickyRightOffsets: computeStickyOffsets(
        rightPinnedIds,
        effectiveWidth,
        hasRowActions ? (actionsWidth ?? WORK_TABLE_ACTIONS_WIDTH) : 0,
      ),
    };
    // `pinnedWidthsSignature` encodes the resolvedWidths values; `leftPinnedKey` /
    // `rightPinnedKey` encode the id lists. The resolvedWidths Map identity is
    // intentionally not a dependency (it churns from un-memoized columnResize).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leftPinnedKey,
    rightPinnedKey,
    pinnedWidthsSignature,
    hasSelection,
    hasRowActions,
    actionsWidth,
  ]);

  return { leftPinnedIds, rightPinnedIds, stickyLeftOffsets, stickyRightOffsets };
}
