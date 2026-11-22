import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { WorkBatchTableColumn } from "./workBatchTableTypes";

/**
 * SR live region for WorkBatchTable: announces sort/resize/reorder so assistive
 * tech gets change feedback (`aria-sort` marks state, but does not announce the
 * transition). Returns the announcement text plus the three announce callbacks.
 */
export function useWorkBatchTableAnnouncements<TData extends { id: string | number }>(
  columns: WorkBatchTableColumn<TData>[],
): {
  announcement: string;
  announceSort: (id: string, dir: "asc" | "desc") => void;
  announceResize: (id: string, width: number) => void;
  announceReorder: (id: string) => void;
} {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = React.useState("");
  const resolveColumnLabel = React.useCallback(
    (id: string) => columns.find((c) => c.id === id)?.label ?? id,
    [columns],
  );
  const announceSort = React.useCallback(
    (id: string, dir: "asc" | "desc") =>
      setAnnouncement(
        t("table.sortedBy", {
          field: resolveColumnLabel(id),
          direction: dir === "asc" ? t("table.sortAscending") : t("table.sortDescending"),
        }),
      ),
    [t, resolveColumnLabel],
  );
  const announceResize = React.useCallback(
    (id: string, width: number) =>
      setAnnouncement(t("table.columnResized", { field: resolveColumnLabel(id), width })),
    [t, resolveColumnLabel],
  );
  const announceReorder = React.useCallback(
    (id: string) => setAnnouncement(t("table.columnMoved", { field: resolveColumnLabel(id) })),
    [t, resolveColumnLabel],
  );
  return { announcement, announceSort, announceResize, announceReorder };
}
