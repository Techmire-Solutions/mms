import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type DirectoryTrashStateTuple = [
  boolean,
  (showDeleted: boolean | ((prev: boolean) => boolean)) => void,
  () => void,
];

export interface DirectoryTrashStateObject {
  viewingDeleted: boolean;
  setViewingDeleted: (showDeleted: boolean | ((prev: boolean) => boolean)) => void;
  toggleTrash: () => void;
}

export type UseDirectoryTrashStateReturn = DirectoryTrashStateTuple & DirectoryTrashStateObject;

/**
 * Hook to synchronize soft-delete trash mode (?view=trash or ?archived=true)
 * with URL search parameters while strictly preserving query, facet, and pagination filters.
 *
 * Supports both tuple destructuring `[viewingDeleted, setViewingDeleted, toggleTrash]`
 * and object destructuring `{ viewingDeleted, setViewingDeleted, toggleTrash }`.
 */
export function useDirectoryTrashState(): UseDirectoryTrashStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewingDeleted =
    searchParams.get("view") === "trash" || searchParams.get("archived") === "true";

  const setViewingDeleted = useCallback(
    (action: boolean | ((prev: boolean) => boolean)) => {
      setSearchParams(
        (prev) => {
          const current = prev.get("view") === "trash" || prev.get("archived") === "true";
          const nextVal = typeof action === "function" ? action(current) : action;
          const next = new URLSearchParams(prev);
          if (nextVal) {
            next.set("view", "trash");
          } else {
            next.delete("view");
            next.delete("archived");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleTrash = useCallback(() => {
    setViewingDeleted((prev) => !prev);
  }, [setViewingDeleted]);

  const result = [viewingDeleted, setViewingDeleted, toggleTrash] as UseDirectoryTrashStateReturn;
  result.viewingDeleted = viewingDeleted;
  result.setViewingDeleted = setViewingDeleted;
  result.toggleTrash = toggleTrash;

  return result;
}
